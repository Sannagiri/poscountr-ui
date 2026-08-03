import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useBusinesses } from '@/modules/businesses';

import { useLayoutTemplateDefaults } from '../hooks/useLayoutTemplateDefaults';
import { useLayoutTemplateMutations } from '../hooks/useLayoutTemplateMutations';
import { useLayoutTemplates } from '../hooks/useLayoutTemplates';
import type {
  DocType,
  LayoutTemplate,
  LayoutTemplateDefaultRow,
} from '../types/documentLayouts.types';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  purchase_order: 'Purchase Order',
  thermal_bill: 'Thermal Bill',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/**
 * The tenant-wide library of print layouts — global templates (usable by
 * every business) and business-specific ones, in one list. Which template is
 * the *default* per `(business|global, documentType)` is a separate concept
 * (`LayoutTemplateDefault`, set from the respective Invoices/Orders
 * (Quotation settings)/Purchasing settings page's own `DefaultLayoutSelector`
 * — not from this list or the editor page) — surfaced here as a "Default
 * for" badge per row via `useLayoutTemplateDefaults`, which fetches every
 * raw default row in the tenant in one call rather than one `resolve/` call
 * per row per supported doc type.
 */
export function LayoutListPage() {
  const navigate = useNavigate();
  const layoutTemplatesQuery = useLayoutTemplates();
  const businessesQuery = useBusinesses();
  const defaultsQuery = useLayoutTemplateDefaults();
  const { deleteLayoutTemplate } = useLayoutTemplateMutations();

  const [pendingDelete, setPendingDelete] = useState<LayoutTemplate | null>(null);

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const business of businessesQuery.data ?? []) map.set(business.id, business.name);
    return map;
  }, [businessesQuery.data]);

  const defaultsByLayoutId = useMemo(() => {
    const map = new Map<string, LayoutTemplateDefaultRow[]>();
    for (const row of defaultsQuery.data ?? []) {
      const rowsForLayout = map.get(row.layoutTemplateId) ?? [];
      rowsForLayout.push(row);
      map.set(row.layoutTemplateId, rowsForLayout);
    }
    return map;
  }, [defaultsQuery.data]);

  const columns: DataTableColumn<LayoutTemplate>[] = useMemo(
    () => [
      { key: 'name', header: 'Name', width: '1.6fr' },
      {
        key: 'scope',
        header: 'Scope',
        width: '1.2fr',
        render: (row) =>
          row.businessId
            ? (businessNameById.get(row.businessId) ?? 'Unknown business')
            : 'Global (any business)',
      },
      {
        key: 'documentTypes',
        header: 'Document types',
        width: '1.6fr',
        render: (row) => (
          <div className="flex flex-wrap gap-1.5">
            {row.documentTypes.map((docType) => (
              <Badge key={docType} tone="neutral">
                {DOC_TYPE_LABELS[docType]}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'defaultFor',
        header: 'Default for',
        width: '1.8fr',
        render: (row) => {
          const defaults = defaultsByLayoutId.get(row.id) ?? [];
          if (defaults.length === 0) return <span className="text-xs text-ink-faint">—</span>;
          return (
            <div className="flex flex-wrap gap-1.5">
              {defaults.map((defaultRow) => (
                <Badge key={defaultRow.id} tone="success">
                  {DOC_TYPE_LABELS[defaultRow.documentType]} ·{' '}
                  {defaultRow.businessId
                    ? (businessNameById.get(defaultRow.businessId) ?? 'Unknown business')
                    : 'Global'}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '110px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [businessNameById, defaultsByLayoutId],
  );

  const filters: DataTableFilter<LayoutTemplate>[] = useMemo(
    () => [
      {
        key: 'isActive',
        label: 'Status',
        options: STATUS_FILTER_OPTIONS,
        getValue: (row) => (row.isActive ? 'active' : 'inactive'),
        defaultValue: 'active',
      },
    ],
    [],
  );

  const rowActions: DataTableRowAction<LayoutTemplate>[] = useMemo(
    () => [
      {
        label: 'Delete',
        icon: Trash2,
        destructive: true,
        onSelect: (row) => setPendingDelete(row),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Print Layouts"
        subtitle="Design print layouts for invoices, quotations, purchase orders, and thermal bills — global or per business"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/layouts/thermal/new')}>
              New thermal layout
            </Button>
            <Button onClick={() => navigate('/layouts/new')}>New layout</Button>
          </div>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          data={layoutTemplatesQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={layoutTemplatesQuery.isLoading}
          errorMessage={
            layoutTemplatesQuery.isError ? describeApiError(layoutTemplatesQuery.error) : null
          }
          onRetry={() => layoutTemplatesQuery.refetch()}
          emptyTitle="No layouts yet"
          emptyDescription="Every document renders with the built-in default layout until you create one."
          getSearchValue={(row) => row.name}
          searchPlaceholder="Search layouts…"
          filters={filters}
          onRowClick={(row) =>
            navigate(
              row.documentTypes.includes('thermal_bill')
                ? `/layouts/thermal/${row.id}`
                : `/layouts/${row.id}`,
            )
          }
          rowActions={() => rowActions}
        />
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this layout?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" stops appearing in every switcher and can no longer be set as a default. Businesses currently defaulted to it fall back to the next rung (global default, then the built-in system default).`
            : undefined
        }
        confirmText="Delete"
        isLoading={deleteLayoutTemplate.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteLayoutTemplate.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          });
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
