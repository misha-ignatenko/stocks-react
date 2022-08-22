RatingChanges._ensureIndex({dateString: 1, researchFirmId: 1, symbol: 1});
RatingChanges._ensureIndex({dateString: 1, symbol: 1});
RatingChanges._ensureIndex({researchFirmId: 1, symbol: 1, newRatingId: 1, oldRatingId: 1, dateString: 1});
RatingChanges._ensureIndex({newRatingId: 1});
RatingChanges._ensureIndex({dateString: 1});
RatingChanges._ensureIndex({symbol: 1});
RatingChanges._ensureIndex({isError: 1});

EarningsReleases._ensureIndex({reportDateNextFiscalQuarter: 1, symbol: 1});
EarningsReleases._ensureIndex({reportDateNextFiscalQuarter: 1});
EarningsReleases._ensureIndex({symbol: 1, asOf: -1});
EarningsReleases._ensureIndex({symbol: 1});
EarningsReleases._ensureIndex({reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1});
EarningsReleases._ensureIndex({asOf: -1});
