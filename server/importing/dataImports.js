if (Meteor.isServer) {
    var _totalMaxGradingValue = 120;

    Meteor.methods({
        importData: function(importData, importType) {
            //run all the checks here

            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            var _result = {};

            var _userId = Meteor.userId();
            var _permissions = _userId && Meteor.users.findOne(_userId).permissions;
            var _dataImportingPermissions = _permissions && _permissions.dataImports;
            var _upgradesDowngradesImportPermission = _dataImportingPermissions && _dataImportingPermissions.indexOf("canImportUpgradesDowngrades") > -1;
            var _ratingScalesImportPermission = _dataImportingPermissions && _dataImportingPermissions.indexOf("canImportRatingScales") > -1;

            if (importType === "upgrades_downgrades" && _upgradesDowngradesImportPermission) {
                _result.couldNotFindGradingScalesForTheseUpDowngrades = [];
                _result.upgradesDowngradesImportStats = {};
                var _numToImport = importData.length;
                var _newlyImportedNum = 0;
                var _alreadyExistingNum = 0;
                var _checkForEarningsReleasesForTheseSymbols = [];
                if (!Meteor.serverConstants.pullFromQuandEveryNDays) {
                    _result.serverConstantsNotOk = {
                        pullFromQuandEveryNDays: Meteor.serverConstants.pullFromQuandEveryNDays
                    };
                }
                importData.forEach(function(importItem) {
                    //check if symbol isn't already in  _checkForEarningsReleasesForTheseSymbols
                    if (_checkForEarningsReleasesForTheseSymbols.indexOf(importItem.symbol) === -1) {
                        _checkForEarningsReleasesForTheseSymbols.push(importItem.symbol);
                    }

                    //first, check if that research company exists
                    var _researchCompany = ResearchCompanies.findOne({name: importItem.researchFirmString});
                    var _researchCompanyId;
                    if (_researchCompany) {
                        _researchCompanyId = _researchCompany._id;
                    } else {
                        _researchCompanyId = ResearchCompanies.insert({name: importItem.researchFirmString});
                    }

                    //second, get rating scales id so that can check if item already exists in RatingChanges
                    var _ratingScaleObjectForNew = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.newRatingString});
                    var _ratingScaleObjectForOld = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.oldRatingString});
                    if (_ratingScaleObjectForNew && _ratingScaleObjectForOld) {
                        //can try to check if this RatingChanges item already exists. if not then insert it.
                        var _existingRatingChange = RatingChanges.findOne({
                            researchFirmId: _researchCompanyId,
                            symbol: importItem.symbol,
                            newRatingId: _ratingScaleObjectForNew._id,
                            oldRatingId: _ratingScaleObjectForOld._id,
                            dateString: importItem.dateString
                        });
                        if (_existingRatingChange) {
                            _alreadyExistingNum++;
                        }
                        if (!_existingRatingChange && importItem.symbol && importItem.researchFirmString && importItem.dateString && importItem.newRatingString && importItem.oldRatingString) {
                            // can insert
                            var _ratingChange = {
                                date: new Date(importItem.dateString).toUTCString(),
                                dateString: importItem.dateString,
                                //dateValue: moment(importItem.dateString).valueOf(),
                                researchFirmId: _researchCompanyId,
                                symbol: importItem.symbol,
                                newRatingId: _ratingScaleObjectForNew._id,
                                oldRatingId: _ratingScaleObjectForOld._id,
                                private: true,
                                addedBy: Meteor.userId(),
                                addedOn: new Date().toUTCString()
                            };
                            console.log("adding this stock: ", importItem.symbol);
                            RatingChanges.insert(_ratingChange);
                            _newlyImportedNum++;
                        }
                    } else {
                        //add to error object to let user know these rating scales need to be added
                        //Note: both old and new have to exist.
                        var _new = JSON.stringify({
                            researchFirmString: importItem.researchFirmString,
                            ratingString: importItem.newRatingString
                        });
                        if (_result.couldNotFindGradingScalesForTheseUpDowngrades.indexOf(_new) === -1) {
                            _result.couldNotFindGradingScalesForTheseUpDowngrades.push(_new);
                        }

                        var _old = JSON.stringify({
                            researchFirmString: importItem.researchFirmString,
                            ratingString: importItem.oldRatingString
                        });
                        if (_result.couldNotFindGradingScalesForTheseUpDowngrades.indexOf(_old) === -1) {
                            _result.couldNotFindGradingScalesForTheseUpDowngrades.push(_old);
                        }
                    }
                });

                if (_checkForEarningsReleasesForTheseSymbols.length > 0) {
                    Meteor.call("importData", _checkForEarningsReleasesForTheseSymbols, "earnings_releases");
                }

                _result.upgradesDowngradesImportStats.total = _numToImport;
                _result.upgradesDowngradesImportStats.new = _newlyImportedNum;
                _result.upgradesDowngradesImportStats.duplicates = _alreadyExistingNum;
                var _destringified = [];
                _result.couldNotFindGradingScalesForTheseUpDowngrades.forEach(function(obj) {
                    _destringified.push(JSON.parse(obj))
                })
                _result.couldNotFindGradingScalesForTheseUpDowngrades = _destringified;
            } else if (importType === "upgrades_downgrades" && !_upgradesDowngradesImportPermission) {
                _result.noPermissionToImportUpgradesDowngrades = true;
            } else if (importType === "earnings_releases") {
                console.log("earnings_releases import function called with: ", importData);
                importData.forEach(function(importItem) {

                    if (_canPullAgainFromQuandl(importItem)) {
                        //TODO check if this earnings release already exists -- check for plus minus 5 days around it
                        var _earningRelease = {
                            symbol: importItem
                        };


                        var _authToken = "";
                        var _symbol = _earningRelease.symbol;
                        var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + _symbol + ".json?auth_token=" + _authToken;
                        HTTP.get(_url, function (error, result) {
                            if (!error && result) {
                                //TODO check if earnings release data for that stock exists.
                                //TODO should only have 1 record per symbol and expand it WITH NEW STUFF ONLY over time.
                                var _resultColumnNames = result.data.dataset.column_names;
                                var _newEarningsData = result.data.dataset.data[0];
                                var _objectFromQuandlMyDbFormat = {};
                                var _i = 0;
                                _resultColumnNames.forEach(function (fieldName, index) {
                                    var _convertedFieldName = _convertQuandlZEAfieldName(fieldName);
                                    if (_convertedFieldName) {
                                        _objectFromQuandlMyDbFormat[_convertedFieldName] = _newEarningsData[index];
                                        _i++;
                                    }
                                });
                                if (_i === 14) {
                                    console.log("object from quandl: ", _objectFromQuandlMyDbFormat);
                                    //now check if any of the existing earnings releases match this one we are trying to import

                                    if (result.statusCode === 200) {
                                        var _matchingEarningsReleaseId = _matchingEntryExistsInEarningsReleases(_symbol, _objectFromQuandlMyDbFormat);
                                        _.extend(_earningRelease, _objectFromQuandlMyDbFormat);
                                        var _lastMod = {
                                            lastModified: new Date().toUTCString(),
                                            lastModifiedBy: Meteor.userId()
                                        };
                                        _.extend(_earningRelease, _lastMod);

                                        if (!_matchingEarningsReleaseId) {
                                            console.log("inserting into earningsReleases: ", _earningRelease);
                                            EarningsReleases.insert(_earningRelease);
                                        } else {
                                            var _previousAsOfField = EarningsReleases.findOne({_id: _matchingEarningsReleaseId}).asOf;
                                            var _latestAsOfField = _objectFromQuandlMyDbFormat.asOf;
                                            if (_previousAsOfField !== _latestAsOfField) {
                                                EarningsReleases.update(
                                                    {_id: _matchingEarningsReleaseId},
                                                    {$set:
                                                        _.extend({asOf: _objectFromQuandlMyDbFormat.asOf}, _lastMod)
                                                    }
                                                );
                                            }
                                        }
                                    }
                                } else {
                                    console.log("ERROR. _i is less than 14.");
                                }
                            } else {
                                console.log("error while getting a response from Quandl. Symbol: ", _symbol);
                            }
                        });
                    }
                });
            } else if (importType === "grading_scales" && _ratingScalesImportPermission) {
                var _allRatings = importData.thresholdStringsArray;
                var _researchFirmString = importData.researchFirmString;
                //get an id of that research company
                var _researchCompany = ResearchCompanies.findOne({name: _researchFirmString});
                var _researchCompanyId;
                if (_researchCompany) {
                    _researchCompanyId = _researchCompany._id;
                } else {
                    _researchCompanyId = ResearchCompanies.insert({name: _researchFirmString});
                }

                var _noneOfGradingScalesForThisFirmAlreadyExist = true;
                _allRatings.forEach(function(ratingString) {
                    if (RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: ratingString})) {
                        _noneOfGradingScalesForThisFirmAlreadyExist = false;
                    }
                });

                if (_noneOfGradingScalesForThisFirmAlreadyExist) {
                    //now eval approx how many points each and insert into collection.
                    var _valuePerThreshold = Math.round(_totalMaxGradingValue / _allRatings.length)
                    _allRatings.forEach(function(value, index) {
                        RatingScales.insert({
                            researchFirmId: _researchCompanyId,
                            firmRatingFullString: value,
                            universalScaleValue: index * _valuePerThreshold + Math.round(_valuePerThreshold / 2)
                        });
                    })
                }

                var _beforeCoverageInitiatedString = importData.beforeCoverageInitiatedString;
                var _coverageDroppedString = importData.coverageDroppedString;
                var _coverageTemporarilySuspendedString = importData.coverageTemporarilySuspendedString;
                if (!RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: _beforeCoverageInitiatedString, universalScaleValue: "beforeCoverageInitiatedString"})) {
                    RatingScales.insert({researchFirmId: _researchCompanyId, firmRatingFullString: _beforeCoverageInitiatedString, universalScaleValue: "beforeCoverageInitiatedString"});
                }

                if (!RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: _coverageDroppedString, universalScaleValue: "coverageDroppedString"})) {
                    RatingScales.insert({researchFirmId: _researchCompanyId, firmRatingFullString: _coverageDroppedString, universalScaleValue: "coverageDroppedString"});
                }

                if (_coverageTemporarilySuspendedString && !RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: _coverageTemporarilySuspendedString, universalScaleValue: "coverageTemporarilySuspendedString"})) {
                    RatingScales.insert({researchFirmId: _researchCompanyId, firmRatingFullString: _coverageTemporarilySuspendedString, universalScaleValue: "coverageTemporarilySuspendedString"});
                }

            } else if (importType === "grading_scales" && !_ratingScalesImportPermission) {
                _result.cannotImportGradingScalesDueToMissingPermissions = true;
            }

            return _result;
        }
    });

    function _convertQuandlZEAfieldName(zeaFieldName) {
        /*PER_END_DATE_FR0 : The end date of the most recently reported fiscal year. (YYYYMMDD)
         endDateMostRecentFiscalYear

         PER_END_DATE_QR1 : The end date of the next fiscal quarter to be reported. (YYYYMMDD)
         endDateNextFiscalQuarter

         EPS_MEAN_EST_QR1 : The Zacks consensus estimated earnings per share (EPS) for the next fiscal quarter to be reported, calculated as the arithmetic mean of all individual sell-side EPS estimates, using the Zacks proprietary BNRI accounting methodology.
         epsMeanEstimateNextFiscalQuarter

         EXP_RPT_DATE_QR1 : The expected report date for the next fiscal quarter's earnings. (QR1) (YYYYMMDD)
         reportDateNextFiscalQuarter

         EXP_RPT_DATE_QR2 : The expected report date for the fiscal quarter after the next fiscal quarter. (QR2) (YYYYMMDD)
         reportDateNextNextFiscalQuarter

         EXP_RPT_DATE_FR1 : The expected report date for the next fiscal year's earnings. (FR1) (YYYYMMDD)
         reportDateNextFiscalYear

         LATE_LAST_FLAG : Indicates whether the report is late and by how long. Values in this field will be one of the following: 0 (not late), 1 (more that 3 days late), 2 (more than 20 days late) or 3 (Unknown).
         lateMostRecentReportFlag

         SOURCE_FLAG : Indicates whether the expected report date comes from a company issued confirmation or from a Zacks mathematical algorithm. Values in this field will be one of the following: 1 (Company confirmed), 2 (Estimated based on algorithm) or 3 (Unknown). This field only applies to the next expected quarterly report date. Expected report dates for fiscal periods further out are considered "Estimated" until company confirmations are received for those dates.
         reportSourceFlag

         TIME_OF_DAY_CODE : Indicates the time of day when the earnings announcement is expected. Values in this field will be one of the following: 1 (After market close), 2 (Before the open), 3 (During market trading) or 4 (Unknown).
         reportTimeOfDayCode

         EPS_ACT_QR0 : Actual earnings per share (EPS) for the prior (mostly recently reported) fiscal quarter (QR-0)
         epsActualPreviousFiscalQuarter

         PER_END_DATE_QR0 : The end date of the prior (most recently reported) fiscal quarter (QR0) (YYYYMMDD)
         endDatePreviousFiscalQuarter

         EPS_ACT_QRM3 : Actual earnings per share (EPS) for the one year prior fiscal quarter (QR-3)
         epsActualOneYearAgoFiscalQuarter

         PER_END_DATE_QRM3 : Period end date for the one year prior fiscal quarter (QR-3) (YYYYMMDD)
         endDateOneYearAgoFiscalQuarter

         */
        var _fieldNameToReturn;

        if (zeaFieldName === "PER_END_DATE_FR0") {
            _fieldNameToReturn = "endDateMostRecentFiscalYear";
        } else if (zeaFieldName === "PER_END_DATE_QR1") {
            _fieldNameToReturn = "endDateNextFiscalQuarter";
        } else if (zeaFieldName === "EPS_MEAN_EST_QR1") {
            _fieldNameToReturn = "epsMeanEstimateNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_QR1") {
            _fieldNameToReturn = "reportDateNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_QR2") {
            _fieldNameToReturn = "reportDateNextNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_FR1") {
            _fieldNameToReturn = "reportDateNextFiscalYear";
        } else if (zeaFieldName === "LATE_LAST_FLAG") {
            _fieldNameToReturn = "lateMostRecentReportFlag";
        } else if (zeaFieldName === "SOURCE_FLAG") {
            _fieldNameToReturn = "reportSourceFlag";
        } else if (zeaFieldName === "TIME_OF_DAY_CODE") {
            _fieldNameToReturn = "reportTimeOfDayCode";
        } else if (zeaFieldName === "EPS_ACT_QR0") {
            _fieldNameToReturn = "epsActualPreviousFiscalQuarter";
        } else if (zeaFieldName === "PER_END_DATE_QR0") {
            _fieldNameToReturn = "endDatePreviousFiscalQuarter";
        } else if (zeaFieldName === "EPS_ACT_QRM3") {
            _fieldNameToReturn = "epsActualOneYearAgoFiscalQuarter";
        } else if (zeaFieldName === "PER_END_DATE_QRM3") {
            _fieldNameToReturn = "endDateOneYearAgoFiscalQuarter";
        } else if (zeaFieldName === "AS_OF") {
            _fieldNameToReturn = "asOf";
        }

        return _fieldNameToReturn;
    }

    function _matchingEntryExistsInEarningsReleases(_symbol, _objectFromQuandlMyDbFormat) {
        var _matchingEarningReleaseId;
        var _allExistingEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol});
        _allExistingEarningsReleasesForSymbol.forEach(function(existingRelease) {
            console.log("existing release: ", existingRelease);
            var _allFieldsMatch = true;
            for (var key in _objectFromQuandlMyDbFormat) {
                console.log("checking key: ", key);
                if (key !== "asOf" && _objectFromQuandlMyDbFormat.hasOwnProperty(key) && (!existingRelease.hasOwnProperty(key) || _objectFromQuandlMyDbFormat[key] !== existingRelease[key])) {
                    console.log("key does not match: ", key);
                    _allFieldsMatch = false;
                    break;
                }
            }
            if (_allFieldsMatch) {
                _matchingEarningReleaseId = existingRelease._id;
            }
        })
        return _matchingEarningReleaseId;
    }

    function _canPullAgainFromQuandl(symbol) {
        var _canPull = false;

        var _canPullFromQuandlEveryNDays;
        if (Meteor.serverConstants.pullFromQuandEveryNDays) {
            _canPullFromQuandlEveryNDays = Meteor.serverConstants.pullFromQuandEveryNDays;
        }

        var _lastPullFromQuandl;
        var _latestEarningsRelease = EarningsReleases.findOne({symbol: symbol}, {sort: {asOf: -1}});
        if (_latestEarningsRelease) {
            _lastPullFromQuandl = _latestEarningsRelease.asOf;
        }
        var _todaysDateInteger = parseInt(moment(new Date().toISOString()).format("YYYYMMDD"));

        if (
            !_lastPullFromQuandl ||
            (_lastPullFromQuandl && _canPullFromQuandlEveryNDays && parseInt(moment(new Date(_lastPullFromQuandl)).add(_canPullFromQuandlEveryNDays + 1, 'days').format("YYYYMMDD")) <= _todaysDateInteger)
        ) {
            _canPull = true;
        }

        return _canPull;
    };
}