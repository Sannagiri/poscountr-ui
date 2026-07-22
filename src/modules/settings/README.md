# settings module

Profile (read-only), change password (tenant_admin only — this route is
`RequireRole roles={['tenant_admin']}`, and managers/kitchen_staff use a PIN
so they never reach it), "My plan & usage" (`TenantLicensePlanView`), and
per-business invoice numbering/branding (`InvoiceSettingsView`,
`apps/invoicing/`).

Built as part of **F7 — Reports & Settings**. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D7.
