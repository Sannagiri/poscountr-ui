import { apiClient, unwrap } from '@/services/apiClient';

import type {
  DocType,
  EffectiveLayout,
  LayoutAlternative,
  LayoutConfig,
  LayoutDefaultTarget,
  LayoutTemplate,
  LayoutTemplateDefaultRow,
  LayoutTemplateRequest,
  LayoutTemplateUpdateRequest,
} from '../types/documentLayouts.types';

/**
 * All calls to `/tenant/document-layouts/` live here — components and
 * hooks never call `apiClient` directly (docs/coding-standards.md §14).
 * Request/response bodies are translated between the backend's snake_case
 * field names and this module's camelCase types, same convention
 * `settingsService.ts` uses. `config` itself is passed through untouched —
 * it's already a plain JSON blob whose own internal shape
 * (`LayoutConfig.table.color_theme`, etc.) stays snake_case on both sides
 * per `buildDocumentPdf.ts`'s own doc comment, so there's nothing to map
 * there.
 */

interface LayoutTemplateRaw {
  id: string;
  name: string;
  business_id: string | null;
  document_types: DocType[];
  config: LayoutConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapLayoutTemplate(raw: LayoutTemplateRaw): LayoutTemplate {
  return {
    id: raw.id,
    name: raw.name,
    businessId: raw.business_id,
    documentTypes: raw.document_types,
    config: raw.config,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function layoutTemplateRequestToBody(request: LayoutTemplateRequest) {
  return {
    name: request.name,
    business_id: request.businessId ?? null,
    document_types: request.documentTypes,
    config: request.config,
  };
}

function layoutTemplateUpdateRequestToBody(request: LayoutTemplateUpdateRequest) {
  const body: Record<string, unknown> = {};
  if (request.name !== undefined) body.name = request.name;
  if (request.documentTypes !== undefined) body.document_types = request.documentTypes;
  if (request.config !== undefined) body.config = request.config;
  if (request.isActive !== undefined) body.is_active = request.isActive;
  return body;
}

function defaultTargetToBody(target: LayoutDefaultTarget) {
  return {
    business_id: target.businessId ?? null,
    document_type: target.documentType,
  };
}

interface LayoutAlternativeRaw {
  id: string;
  name: string;
  is_global: boolean;
  document_types: DocType[];
}

function mapLayoutAlternative(raw: LayoutAlternativeRaw): LayoutAlternative {
  return {
    id: raw.id,
    name: raw.name,
    isGlobal: raw.is_global,
    documentTypes: raw.document_types,
  };
}

interface EffectiveLayoutRaw {
  layout: LayoutTemplateRaw | null;
  source: EffectiveLayout['source'];
  config: LayoutConfig;
  alternatives: LayoutAlternativeRaw[];
}

interface LayoutTemplateDefaultRaw {
  id: string;
  business_id: string | null;
  document_type: DocType;
  layout_template_id: string;
}

function mapLayoutTemplateDefaultRow(raw: LayoutTemplateDefaultRaw): LayoutTemplateDefaultRow {
  return {
    id: raw.id,
    businessId: raw.business_id,
    documentType: raw.document_type,
    layoutTemplateId: raw.layout_template_id,
  };
}

function mapEffectiveLayout(raw: EffectiveLayoutRaw): EffectiveLayout {
  return {
    layout: raw.layout ? mapLayoutTemplate(raw.layout) : null,
    source: raw.source,
    config: raw.config,
    alternatives: raw.alternatives.map(mapLayoutAlternative),
  };
}

export const documentLayoutsService = {
  async list(filter?: { businessId?: string; documentType?: DocType }): Promise<LayoutTemplate[]> {
    const raw = await unwrap<LayoutTemplateRaw[]>(
      apiClient.get('/tenant/document-layouts/', {
        params: { business_id: filter?.businessId, document_type: filter?.documentType },
      }),
    );
    return raw.map(mapLayoutTemplate);
  },

  async get(id: string): Promise<LayoutTemplate> {
    const raw = await unwrap<LayoutTemplateRaw>(apiClient.get(`/tenant/document-layouts/${id}/`));
    return mapLayoutTemplate(raw);
  },

  async create(data: LayoutTemplateRequest): Promise<LayoutTemplate> {
    const raw = await unwrap<LayoutTemplateRaw>(
      apiClient.post('/tenant/document-layouts/', layoutTemplateRequestToBody(data)),
    );
    return mapLayoutTemplate(raw);
  },

  async update(id: string, data: LayoutTemplateUpdateRequest): Promise<LayoutTemplate> {
    const raw = await unwrap<LayoutTemplateRaw>(
      apiClient.patch(`/tenant/document-layouts/${id}/`, layoutTemplateUpdateRequestToBody(data)),
    );
    return mapLayoutTemplate(raw);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/tenant/document-layouts/${id}/`);
  },

  async setDefault(id: string, target: LayoutDefaultTarget): Promise<void> {
    await apiClient.post(
      `/tenant/document-layouts/${id}/set-default/`,
      defaultTargetToBody(target),
    );
  },

  async unsetDefault(id: string, target: LayoutDefaultTarget): Promise<void> {
    await apiClient.post(
      `/tenant/document-layouts/${id}/unset-default/`,
      defaultTargetToBody(target),
    );
  },

  /**
   * The switcher-friendly read every document preview drives off — the
   * fallback chain resolved server-side (business default -> global
   * default -> system default) plus every other active template offered as
   * an alternative. `businessId` omitted resolves the tenant-wide/global
   * chain only (no business-scoped default can apply).
   */
  async resolveEffective(filter: {
    businessId?: string;
    documentType: DocType;
  }): Promise<EffectiveLayout> {
    const raw = await unwrap<EffectiveLayoutRaw>(
      apiClient.get('/tenant/document-layouts/resolve/', {
        params: { business_id: filter.businessId, document_type: filter.documentType },
      }),
    );
    return mapEffectiveLayout(raw);
  },

  /** Every raw `LayoutTemplateDefault` row in the tenant, no fallback resolution — powers the layout list page's "default for X" badges without one `resolve/` call per row per doc type. */
  async listDefaults(): Promise<LayoutTemplateDefaultRow[]> {
    const raw = await unwrap<LayoutTemplateDefaultRaw[]>(
      apiClient.get('/tenant/document-layouts/defaults/'),
    );
    return raw.map(mapLayoutTemplateDefaultRow);
  },
};
