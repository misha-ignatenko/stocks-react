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
                        symbol: importItem.symbol
                    };


                    var _authToken = "";
                    var _symbol = _earningRelease.symbol;
                    var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + _symbol + ".json?auth_token=" + _authToken;
                    HTTP.get(_url, function(error, result) {
                        if (!error && result) {
                            //TODO check if earnings release data for that stock exists.
                            //TODO should only have 1 record per symbol and expand it WITH NEW STUFF ONLY over time.
                            var _resultColumnNames = result.data.dataset.column_names;
                            var _newEarningsData = result.data.dataset.data[0];
                            var _existingEarningReleaseRecord = EarningsReleases.find({symbol: _symbol});


                            //check if any of the existing earningsRelease items already have the exact same items as in the result
                            //if none have that (or there are no items in collection for that symbol already), then can insert a new object into collection


                            var _matchingRequestFound = false;
                            _existingEarningReleaseRecord.forEach(function (obj) {
                                var _allFieldsMatch = true;
                                obj.earningsData.forEach(function (value, index) {
                                    //skip where key is zero because that's date of request, which is irrelevant
                                    //if a field does not match then set _allFieldsMatch to false
                                    if (index > 0 && _newEarningsData[index] !== value) {
                                        _allFieldsMatch = false;
                                    }

                                });
                                //if all fields do indeed match (_allFieldsMatch would have remained true) then set _matchingRequestFound to true
                                if (_allFieldsMatch) {
                                    _matchingRequestFound = true;
                                }
                            });


                            if (!_matchingRequestFound && result.statusCode === 200) {
                                console.log("column names: ", _resultColumnNames);
                                console.log("data: ", _newEarningsData);
                                _.extend(_earningRelease, {
                                    fieldNames: _resultColumnNames,
                                    earningsData: _newEarningsData,
                                    lastModified: new Date().toUTCString(),
                                    lastModifiedBy: Meteor.userId()
                                });
                                console.log("inserting new earnings release: ", JSON.stringify(_earningRelease));
                                EarningsReleases.insert(_earningRelease);
                            }
                        } else {
                            console.log("error while getting a response from Quandl. Symbol: ", _symbol);
                        }
                    });
                });
            }
        }
    })
}