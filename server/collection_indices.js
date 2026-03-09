import {
    RatingChanges,
    EarningsReleases,
    EarningsReleasesFinnhubMonitoring,
    EarningsReleasesNasdaqMonitoring,
} from "../lib/collections";

RatingChanges.createIndex({ dateString: 1, researchFirmId: 1, symbol: 1 });
RatingChanges.createIndex({ dateString: 1, symbol: 1 });
RatingChanges.createIndex({
    researchFirmId: 1,
    symbol: 1,
    newRatingId: 1,
    oldRatingId: 1,
    dateString: 1,
});
RatingChanges.createIndex({ newRatingId: 1 });
RatingChanges.createIndex({ dateString: 1 });
RatingChanges.createIndex({ symbol: 1 });
RatingChanges.createIndex({ isError: 1 });

EarningsReleases.createIndex({ reportDateNextFiscalQuarter: 1, symbol: 1 });
EarningsReleases.createIndex({ reportDateNextFiscalQuarter: 1 });
EarningsReleases.createIndex({ symbol: 1, asOf: -1 });
EarningsReleases.createIndex({ symbol: 1 });
EarningsReleases.createIndex({
    reportSourceFlag: 1,
    reportDateNextFiscalQuarter: 1,
    asOf: -1,
});
EarningsReleases.createIndex({ asOf: -1 });

EarningsReleasesFinnhubMonitoring.createIndex({
    reportDateNextFiscalQuarter: 1,
    symbol: 1,
});
EarningsReleasesFinnhubMonitoring.createIndex({ symbol: 1, asOf: -1 });
EarningsReleasesFinnhubMonitoring.createIndex({ asOf: -1 });

EarningsReleasesNasdaqMonitoring.createIndex({
    reportDateNextFiscalQuarter: 1,
    symbol: 1,
});
EarningsReleasesNasdaqMonitoring.createIndex({ symbol: 1, asOf: -1 });
EarningsReleasesNasdaqMonitoring.createIndex({ asOf: -1 });
