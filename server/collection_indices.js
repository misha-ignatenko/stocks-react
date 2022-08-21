RatingChanges._ensureIndex({dateString: 1});
RatingChanges._ensureIndex({symbol: 1});
RatingChanges._ensureIndex({dateString: 1, symbol: 1});
RatingChanges._ensureIndex({newRatingId: 1});

EarningsReleases._ensureIndex({reportDateNextFiscalQuarter: 1, symbol: 1});
EarningsReleases._ensureIndex({reportDateNextFiscalQuarter: 1});
EarningsReleases._ensureIndex({symbol: 1, asOf: -1});
EarningsReleases._ensureIndex({symbol: 1});
EarningsReleases._ensureIndex({reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1});
EarningsReleases._ensureIndex({asOf: -1});
