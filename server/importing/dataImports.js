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
                        pulledDataFromQuandl: false
                    };


                    var _authToken = "";
                    var _symbol = _earningRelease.symbol;
                    var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + _symbol + ".json?auth_token=" + _authToken;
                    HTTP.get(_url, function(error, result) {
                        if (!error && result) {
                            //TODO check if earnings release data for that stock exists.
                            //TODO should only have 1 record per symbol and expand it WITH NEW STUFF ONLY over time.
                            var _existingEarningReleaseRecord = EarningsReleases.findOne({symbol: _symbol, pulledDataFromQuandl: true});
                            if (_existingEarningReleaseRecord) {
                                //do not insert, update the existing record with new fields
                                var _earningsReleaseId = _existingEarningReleaseRecord._id;
                                var _existingEarningsReleaseData = _existingEarningReleaseRecord.earningsReleaseData;
                                var _newEarningsData = result.data.dataset.data[0];
                                var _matchingRequestFound = false;
                                _existingEarningsReleaseData.forEach(function(obj) {
                                    var _allFieldsMatch = true;
                                    obj.earningsData.forEach(function(value, index) {
                                        //skip where key is zero because that's date of request, which is irrelevant
                                        //if a field does not match then set _allFieldsMatch to false
                                        if (index > 0 && _newEarningsData[index] !== value) {
                                            _allFieldsMatch = false;
                                        }

                                    });
                                    //if all fields do indeed match then set _matchingRequestFound to true
                                    if (_allFieldsMatch) {
                                        _matchingRequestFound = true;
                                    }
                                });


                                if (!_matchingRequestFound) {
                                    //need to insert to earningReleaseData array
                                    console.log("inserting new item into array of earnings release data");
                                    var _objToPush = {
                                        fieldNames: result.data.dataset.column_names,
                                        earningsData: result.data.dataset.data[0],
                                        lastModified: new Date().toUTCString(),
                                        lastModifiedBy: Meteor.userId()
                                    };
                                    EarningsReleases.update({_id: _earningsReleaseId}, {$push: {earningsReleaseData: _objToPush}})
                                }
                            } else if (result.statusCode === 200) {
                                console.log("column names: ", result.data.dataset.column_names);
                                console.log("data: ", result.data.dataset.data[0]);
                                _earningRelease.pulledDataFromQuandl = true;
                                _.extend(_earningRelease, {
                                    earningsReleaseData: [{
                                        fieldNames: result.data.dataset.column_names,
                                        earningsData: result.data.dataset.data[0],
                                        lastModified: new Date().toUTCString(),
                                        lastModifiedBy: Meteor.userId()
                                    }]
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