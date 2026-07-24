import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Button, ErrorMessage, Input, Loader, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import type { Location } from '@/modules/businesses';

import { TABLE_SHAPE_OPTIONS, TABLE_SIZE_OPTIONS } from '../../constants/tables.constants';
import { useTableMutations } from '../../hooks/useTableMutations';
import { useTables } from '../../hooks/useTables';
import type { Table } from '../../types/tables.types';
import type { TableFormValues } from '../../validations/tables.validation';
import { tableFormSchema } from '../../validations/tables.validation';
import { TableLayoutCanvas } from '../TableLayoutCanvas';

import { zodResolver } from '@hookform/resolvers/zod';

export interface TableLayoutEditorModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern as `OrderBillPreviewModal`. */
  location: Location | null;
  onClose: () => void;
}

type View = 'canvas' | 'form';

const EMPTY_FORM_VALUES: TableFormValues = { name: '', shape: 'round', size: 'medium', seats: 4 };

/**
 * Design a location's floor plan — the "Edit layout" action from
 * `LocationsModal`. One modal, `view`-state-driven (same shape
 * `StockModal`/`BatchesModal` use): a canvas of draggable table chips, and
 * a form (shared by add + edit) for name/shape/size/seats + delete.
 * Dragging persists on pointer-up via a debounce-free direct PATCH per
 * table — occasional edits, not a per-keystroke autosave.
 */
export function TableLayoutEditorModal({ location, onClose }: TableLayoutEditorModalProps) {
  const open = Boolean(location);
  const locationId = location?.id ?? '';
  const { showToast } = useToast();

  const tablesQuery = useTables(locationId);
  const { createTable, updateTable, deleteTable } = useTableMutations(locationId);

  const [view, setView] = useState<View>('canvas');
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TableFormValues>({
    resolver: zodResolver(tableFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView('canvas');
      setEditingTable(null);
      setFormError(null);
    }
  }

  function openCreateForm() {
    setEditingTable(null);
    setFormError(null);
    reset(EMPTY_FORM_VALUES);
    setView('form');
  }

  function openEditForm(table: Table) {
    setEditingTable(table);
    setFormError(null);
    reset({ name: table.name, shape: table.shape, size: table.size, seats: table.seats });
    setView('form');
  }

  function handlePositionChange(tableId: string, posX: number, posY: number) {
    updateTable.mutate(
      { id: tableId, request: { posX, posY } },
      { onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }) },
    );
  }

  function onSubmit(values: TableFormValues) {
    const request = { name: values.name, shape: values.shape, size: values.size, seats: values.seats };
    // A brand-new table starts at the canvas's center (dragged into place
    // from there) rather than the backend's raw (0, 0) default, which
    // would render clipped in the top-left corner.
    const mutation = editingTable
      ? updateTable.mutateAsync({ id: editingTable.id, request })
      : createTable.mutateAsync({ ...request, posX: 50, posY: 50 });
    mutation.then(() => setView('canvas')).catch((error) => setFormError(describeApiError(error)));
  }

  function handleDelete() {
    if (!editingTable) return;
    deleteTable.mutate(editingTable.id, {
      onSuccess: () => setView('canvas'),
      onError: (error) => setFormError(describeApiError(error)),
    });
  }

  const isOccupied = Boolean(editingTable?.currentOrder);
  const isSaving = createTable.isPending || updateTable.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={
        view === 'canvas'
          ? `Table layout — ${location?.name ?? ''}`
          : editingTable
            ? `Edit ${editingTable.name}`
            : 'Add table'
      }
      description={view === 'canvas' ? 'Drag a table to match your floor plan' : undefined}
      size="xl"
      footer={
        view === 'canvas' ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setView('canvas')}>
              Back
            </Button>
            {editingTable ? (
              <Button
                variant="destructive"
                leadingIcon={<Trash2 size={16} />}
                isLoading={deleteTable.isPending}
                disabled={isOccupied}
                disabledReason={isOccupied ? 'This table has an open order.' : undefined}
                onClick={handleDelete}
              >
                Delete
              </Button>
            ) : null}
            <Button form="table-form" type="submit" isLoading={isSaving}>
              Save
            </Button>
          </>
        )
      }
    >
      {view === 'canvas' ? (
        tablesQuery.isLoading ? (
          <Loader label="Loading tables…" />
        ) : tablesQuery.isError ? (
          <ErrorMessage message={describeApiError(tablesQuery.error)} onRetry={() => tablesQuery.refetch()} />
        ) : (
          <div className="flex flex-col gap-3">
            <TableLayoutCanvas
              tables={tablesQuery.data ?? []}
              mode="edit"
              onTableClick={openEditForm}
              onPositionChange={handlePositionChange}
            />
            <Button
              type="button"
              variant="secondary"
              leadingIcon={<Plus size={14} />}
              onClick={openCreateForm}
            >
              Add table
            </Button>
          </div>
        )
      ) : (
        <form id="table-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {formError ? <ErrorMessage message={formError} /> : null}
          {isOccupied && editingTable?.currentOrder ? (
            <p className="rounded-control bg-warning-bg px-3 py-2 text-xs text-warning-text">
              This table currently has an open order ({editingTable.currentOrder.orderNumber ?? '—'}) —
              complete or cancel it before deleting the table.
            </p>
          ) : null}
          <Input
            label="Table name"
            placeholder="T1"
            {...register('name')}
            errorMessage={errors.name?.message}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="shape"
              render={({ field }) => (
                <Select
                  label="Shape"
                  options={TABLE_SHAPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="size"
              render={({ field }) => (
                <Select
                  label="Size"
                  options={TABLE_SIZE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <Input
            label="Seats"
            type="number"
            min={1}
            step={1}
            {...register('seats')}
            errorMessage={errors.seats?.message}
          />
        </form>
      )}
    </Modal>
  );
}
