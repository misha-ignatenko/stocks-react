if (Meteor.isServer) {
    Meteor.methods({
        importData: function(importData, importType) {
            //run all the checks here
            //make sure date format sis fine
            //check if this data already was imported.

            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            if (importType === "upgrades_downgrades") {
                importData.forEach(function(importItem) {
                    //check here if already exists.
                    //match research firm string to research firm id -- can have different variations
                    //before calling this function ask the user to drag and match the format of pasted data to format of ratingChanges collections
                    var _ratingChange = {
                        date: new Date(importItem.dateString).toUTCString(),
                        researchFirmId: importItem.researchFirmString,
                        symbol: importItem.symbolString,
                        newRatingId: importItem.newRatingString,
                        oldRatingId: importItem.oldRatingString,
                        private: true,
                        addedBy: Meteor.userId()
                    };
                    console.log("adding this stock: ", importItem.symbolString);
                    RatingChanges.insert(_ratingChange);
                });
            } else if (importType === "earnings_releases") {
                importData.forEach(function(importItem) {
                    //TODO check if this earnings release already exists -- check for plus minus 5 days around it
                    var _earningRelease = {
                        symbol: importItem.symbol,
                        date: new Date(importItem.dateString).toUTCString(),
                        releaseTime: importItem.releaseTime,
                        datetime: importItem.datetime ? importItem.datetime: "",
                        source: importItem.source,
                        consensusEps: importItem.consensusEps,
                        numOfEstimates: importItem.numOfEstimates,
                        lastYearsReportDate: new Date(importItem.lastYearsReportDateString).toUTCString(),
                        lastYearsEps: importItem.lastYearsEps
                    };
                    console.log("adding earnings release for ", importItem.symbol, ", date: ", importItem.dateString);
                    EarningsReleases.insert(_earningRelease);
                });
            }
        }
    })
}