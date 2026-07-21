import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Pencil, Upload } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';
import type { BusinessEntity } from '@/modules/businesses';
import { ChooseBusinessModal, useBusinesses } from '@/modules/businesses';

import { ImportProductsModal } from '../components/ImportProductsModal';
import { ProductFormModal } from '../components/ProductFormModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import {
  formatQuantity,
  INVENTORY_QUERY_KEYS,
  isStockRowLow,
} from '../constants/inventory.constants';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { inventoryService } from '../services/inventoryService';
import type { Product } from '../types/inventory.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { product: Product; kind: 'deactivate' | 'activate' } | null;
/** Which action the business picker is being shown for — resolved separately below since a manager skips the picker for either action (their own business is forced server-side; they can't call `useBusinesses` at all — `IsTenantAdmin`-gated, same as `/tenant/businesses/` generally). */
type BusinessPickerFor = 'create' | 'import' | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/** Search matches name, SKU, category, and business. */
function getProductSearchValue(product: Product): string {
  return [product.name, product.sku, product.category, product.businessName]
    .filter(Boolean)
    .join(' ');
}

function isProductLowStock(product: Product): boolean {
  return product.isStockTracked && product.stock.some(isStockRowLow);
}

/** Summing decimal strings as JS numbers can leave float artifacts (e.g. `100.30000000000001`) — `formatQuantity` rounds to the same 3 decimal places the backend stores and trims the noise back off. */
function totalQuantity(product: Product): string {
  const sum = product.stock.reduce((total, row) => total + Number(row.quantity), 0);
  return formatQuantity(String(sum));
}

/**
 * Every product visible to the actor, in one flat table — manager pre-scoped
 * to their own business server-side, tenant_admin sees everything (same
 * scoping shape `LocationsPage` already established for locations). No
 * server-side filters exist for this endpoint (confirmed against
 * `apps/inventory/views/products.py` — the planning doc's own "filters:
 * category, business, location, low-stock" promised more than actually
 * shipped), so search/category/status/low-stock are all applied client-side
 * over the one already-fetched list.
 *
 * "Add product" and "Import" both ask which business first
 * (`ChooseBusinessModal`, reused from `@/modules/businesses`) — but only
 * for a tenant_admin; a manager can't call `useBusinesses` at all
 * (`IsTenantAdmin`-gated), and doesn't need to anyway since the backend
 * always forces their own business regardless of what's sent.
 */
export function ProductsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });

  const [formTarget, setFormTarget] = useState<Product | 'create' | null>(null);
  const [formBusinessId, setFormBusinessId] = useState<string | undefined>(undefined);
  const [businessPickerFor, setBusinessPickerFor] = useState<BusinessPickerFor>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusinessId, setImportBusinessId] = useState<string | undefined>(undefined);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>): Promise<string | null> => {
      if (action.kind === 'deactivate') {
        await inventoryService.deactivateProduct(action.product.id);
        return null;
      }
      const result = await inventoryService.activateProduct(action.product.id);
      return result.warning;
    },
    onSuccess: (warning) => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  function startAddProduct() {
    if (isTenantAdmin) {
      setBusinessPickerFor('create');
    } else {
      setFormBusinessId(undefined);
      setFormTarget('create');
    }
  }

  function startImport() {
    if (isTenantAdmin) {
      setBusinessPickerFor('import');
    } else {
      setImportBusinessId(undefined);
      setImportOpen(true);
    }
  }

  const categoryFilterOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ value: category, label: category })),
    [categoriesQuery.data],
  );

  const businessFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of productsQuery.data ?? [])
      seen.set(product.businessId, product.businessName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [productsQuery.data]);

  const lowStockCount = useMemo(
    () => (productsQuery.data ?? []).filter(isProductLowStock).length,
    [productsQuery.data],
  );

  const columns: DataTableColumn<Product>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Product',
        width: '1.5fr',
        render: (row) => (
          <span className="flex min-w-0 items-center gap-2">
            <ProductThumbnail imageUrl={row.imageUrl} name={row.name} />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
          </span>
        ),
      },
      { key: 'sku', header: 'SKU', width: '150px' },
      { key: 'businessName', header: 'Business', width: '1fr' },
      { key: 'category', header: 'Category', width: '160px' },
      {
        key: 'sellingPrice',
        header: 'Price',
        width: '100px',
        align: 'right',
        render: (row) => `₹${row.sellingPrice}`,
      },
      {
        key: 'stock',
        header: 'Stock',
        width: '140px',
        render: (row) =>
          row.isStockTracked ? (
            <span className="flex items-center gap-1.5">
              {totalQuantity(row)}
              {isProductLowStock(row) ? <Badge tone="danger">Low</Badge> : null}
            </span>
          ) : (
            <span className="text-ink-faint">Not tracked</span>
          ),
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '100px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<Product>[] = useMemo(
    () => [
      { key: 'category', label: 'Category', options: categoryFilterOptions },
      { key: 'businessId', label: 'Business', options: businessFilterOptions },
      { key: 'isActive', label: 'Status', options: STATUS_FILTER_OPTIONS },
      {
        key: 'lowStock',
        label: 'Stock level',
        options: [{ value: 'true', label: 'Low stock' }],
        getValue: (row) => String(isProductLowStock(row)),
      },
    ],
    [categoryFilterOptions, businessFilterOptions],
  );

  const rowActions: DataTableRowAction<Product>[] = useMemo(
    () => [
      { label: 'Edit', icon: Pencil, onSelect: (row) => setFormTarget(row) },
      {
        label: 'Deactivate',
        icon: Ban,
        destructive: true,
        disabled: (row) => !row.isActive,
        onSelect: (row) => setPendingToggle({ product: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        disabled: (row) => row.isActive,
        onSelect: (row) => setPendingToggle({ product: row, kind: 'activate' }),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Every product across all of your businesses, in one place"
      />

      {lowStockCount > 0 ? (
        <Card className="mb-4 flex items-center gap-2">
          <Badge tone="danger">{lowStockCount}</Badge>
          <span className="text-sm text-ink">
            {lowStockCount === 1 ? 'product is' : 'products are'} at or below its reorder level —
            filter by &quot;Low stock&quot; below to find them.
          </span>
        </Card>
      ) : null}

      <Card>
        <DataTable
          columns={columns}
          data={productsQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={productsQuery.isLoading}
          errorMessage={productsQuery.isError ? describeApiError(productsQuery.error) : null}
          onRetry={() => productsQuery.refetch()}
          emptyTitle="No products yet"
          emptyDescription="Add your first product using the button above, or import a batch from Excel."
          getSearchValue={getProductSearchValue}
          searchPlaceholder="Search products…"
          filters={filters}
          onRowClick={(row) => setFormTarget(row)}
          toolbarTrailing={
            <div className="flex gap-2">
              <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={startImport}>
                Import
              </Button>
              <Button onClick={startAddProduct}>Add product</Button>
            </div>
          }
          rowActions={() => rowActions}
        />
      </Card>

      <ChooseBusinessModal
        open={businessPickerFor !== null}
        businesses={businessesQuery.data ?? []}
        isLoading={businessesQuery.isLoading}
        onOpenChange={(open) => {
          if (!open) setBusinessPickerFor(null);
        }}
        onContinue={(business: BusinessEntity) => {
          if (businessPickerFor === 'create') {
            setFormBusinessId(business.id);
            setFormTarget('create');
          } else if (businessPickerFor === 'import') {
            setImportBusinessId(business.id);
            setImportOpen(true);
          }
          setBusinessPickerFor(null);
        }}
      />

      <ProductFormModal
        target={formTarget}
        businessId={formBusinessId}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      />

      <ImportProductsModal
        open={importOpen}
        businessId={importBusinessId}
        onOpenChange={setImportOpen}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this product?'
            : 'Activate this product?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.product.name} stops appearing for staff to select at checkout/billing.`
            : pendingToggle
              ? `${pendingToggle.product.name} becomes available again immediately.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
