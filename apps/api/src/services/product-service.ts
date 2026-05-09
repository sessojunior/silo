export {
  formatSlug,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./product-core-service.js";

export {
  appendProductFlowEntry,
  listProductDataFlowPipelines,
} from "./product-data-flow-service.js";

export type { ProductDataFlowPipeline } from "./product-data-flow-service.js";

export {
  PRODUCT_AVAILABILITY_EXCEPTION_TYPES,
  deleteProductAvailabilityException,
  getProductActivityAvailability,
  listProductAvailabilityExceptions,
  type ProductAvailabilityExceptionType,
  upsertProductAvailabilityException,
} from "./product-availability-service.js";

export {
  deleteProductContactAssociation,
  listProductContacts,
  replaceProductContacts,
} from "./product-contact-service.js";

export {
  listProductActivityHistory,
  listProductActivityPendingEmailRecipients,
  sendProductActivityPendingEmail,
  upsertProductActivity,
  updateProductActivity,
} from "./product-activity-service.js";

export {
  getProductManual,
  upsertProductManual,
} from "./product-manual-service.js";

export {
  createProductProblem,
  createProductProblemCategory,
  createProductProblemImage,
  deleteProductProblem,
  deleteProductProblemCategory,
  deleteProductProblemImage,
  listProductProblemCategories,
  listProductProblemImages,
  listProductProblems,
  updateProductProblem,
  updateProductProblemCategory,
} from "./product-problem-service.js";

export {
  createProductDependency,
  deleteProductDependency,
  listProductDependencies,
  reorderProductDependencies,
  updateProductDependency,
} from "./product-dependency-service.js";

export {
  createProductSolution,
  createProductSolutionImage,
  countProductSolutions,
  deleteProductSolution,
  deleteProductSolutionImage,
  getProductSolutionsSummary,
  listProductSolutionImages,
  listProductSolutions,
  updateProductSolution,
} from "./product-solution-service.js";