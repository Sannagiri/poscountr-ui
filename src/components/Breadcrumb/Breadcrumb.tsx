import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Thin breadcrumb trail shown above every page title. Uses router `Link`
 * (not a bare `<a>`) so navigating up a level stays a client-side
 * transition instead of a full-page reload — this matters now that the
 * first real consumer (Tenant detail's "Businesses" crumb) actually links
 * somewhere instead of just labeling the current page.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ink-faint">
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <li>
              {item.href ? (
                <Link to={item.href} className="hover:text-ink-soft">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
