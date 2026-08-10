// ============================================================
// Enterprise Proposal Asset Library — Service Index
// ============================================================

export { proposalAssetLibrary } from './ProposalAssetLibrary';
export { assetSearchEngine } from './AssetSearchEngine';
export { assetRankingEngine } from './AssetRankingEngine';
export { assetRecommendationEngine } from './AssetRecommendationEngine';
export { assetVersionService } from './AssetVersionService';
export { assetApprovalService } from './AssetApprovalService';
export { assetImportService } from './AssetImportService';
export { assetExportService } from './AssetExportService';
export { assetAnalyticsService } from './AssetAnalyticsService';

export type {
  AssetType,
  AssetStatus,
  ApprovalStatus,
  ReviewStatus,
  AssetRelationshipType,
  ProposalAssetRecord,
  AssetCategoryRecord,
  AssetTagRecord,
  AssetVersionRecord,
  AssetRelationshipRecord,
  AssetUsageHistoryRecord,
  AssetReviewRecord,
  AssetRatingRecord,
  AssetWithRelations,
  AssetSearchRequest,
  AssetSearchResult,
  AssetCreateRequest,
  AssetUpdateRequest,
  AssetAnalytics,
  AssetLibraryHealth,
  AssetRecommendation,
  AssetRecommendationRequest,
} from '@/types/proposal-assets';
