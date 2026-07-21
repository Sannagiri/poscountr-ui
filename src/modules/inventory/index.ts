export { INVENTORY_ROUTES } from './constants/inventory.constants';
export { useCategories } from './hooks/useCategories';
export { useProducts } from './hooks/useProducts';
export { ProductsPage } from './pages/ProductsPage';
export { inventoryService } from './services/inventoryService';
export type {
  Batch,
  BatchRequest,
  ImportReport,
  ImportRowError,
  PharmacySchedule,
  Product,
  ProductRequest,
  ProductStockRow,
  StockAdjustRequest,
  StockItem,
  StockSetRequest,
  Unit,
} from './types/inventory.types';
