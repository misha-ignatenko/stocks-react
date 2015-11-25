if (Meteor.isServer) {
    var _totalMaxGradingValue = 120;

    Meteor.methods({
        importData: function(importData, importType) {
            //run all the checks here

            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            var _result = {};

            if (importType === "upgrades_downgrades") {
                _result.couldNotFindGradingScalesForTheseUpDowngrades = [];
                importData.forEach(function(importItem) {
                    var _existingRatingChange = RatingChanges.findOne({
                        researchFirmString: importItem.researchFirmString,
                        symbol: importItem.symbol,
                        newRatingString: importItem.newRatingString,
                        oldRatingString: importItem.oldRatingString
                    });
                    if (!_existingRatingChange) {
                        var _ratingChange = {
                            date: new Date(importItem.dateString).toUTCString(),
                            researchFirmString: importItem.researchFirmString,
                            symbol: importItem.symbol,
                            newRatingString: importItem.newRatingString,
                            oldRatingString: importItem.oldRatingString,
                            private: true,
                            addedBy: Meteor.userId()
                        };
                        var _ratingScaleObjectForNewRatingString = RatingScales.findOne({researchFirmString: importItem.researchFirmString, firmRatingFullString: importItem.newRatingString});
                        var _ratingScaleObjectForOldRatingString = RatingScales.findOne({researchFirmString: importItem.researchFirmString, firmRatingFullString: importItem.oldRatingString});

                        //append numerical rating value if corresponding rating scale exists for new rating
                        if (_ratingScaleObjectForNewRatingString) {
                            _.extend(_ratingChange, {
                                newRatingValue: _ratingScaleObjectForNewRatingString.universalScaleValue
                            });
                        } else {
                            _result.couldNotFindGradingScalesForTheseUpDowngrades.push({
                                researchFirmString: importItem.researchFirmString,
                                ratingString: importItem.newRatingString
                            });
                        }

                        //append numerical rating value if corresponding rating scale exists for old rating
                        if (_ratingScaleObjectForOldRatingString) {
                            _.extend(_ratingChange, {
                                oldRatingValue: _ratingScaleObjectForOldRatingString.universalScaleValue
                            });
                        } else {
                            _result.couldNotFindGradingScalesForTheseUpDowngrades.push({
                                researchFirmString: importItem.researchFirmString,
                                ratingString: importItem.oldRatingString
                            });
                        }

                        if (_ratingChange.oldRatingValue && _ratingChange.newRatingValue) {
                            console.log("adding this stock: ", importItem.symbol);
                            RatingChanges.insert(_ratingChange);
                        }
                    }
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
            } else if (importType === "grading_scales") {
                var _allRatings = importData.thresholdStringsArray;
                var _researchFirmString = importData.researchFirmString;

                var _noneOfGradingScalesForThisFirmAlreadyExist = true;
                _allRatings.forEach(function(ratingString) {
                    if (RatingScales.findOne({researchFirmString: _researchFirmString, firmRatingFullString: ratingString})) {
                        _noneOfGradingScalesForThisFirmAlreadyExist = false;
                    }
                });

                if (_noneOfGradingScalesForThisFirmAlreadyExist) {
                    //now eval approx how many points each and insert into collection.
                    var _valuePerThreshold = Math.round(_totalMaxGradingValue / _allRatings.length)
                    _allRatings.forEach(function(value, index) {
                        RatingScales.insert({
                            researchFirmString: _researchFirmString,
                            firmRatingFullString: value,
                            universalScaleValue: index * _valuePerThreshold + Math.round(_valuePerThreshold / 2)
                        });
                    })
                }
            }

            return _result;
        }
    })
}