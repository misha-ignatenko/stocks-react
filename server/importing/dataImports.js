import moment from 'moment-timezone';
import _ from 'underscore';

var _totalMaxGradingValue = 120;

Meteor.methods({

    removeDupRatingChange: function (ratingChangeId) {
        if (Meteor.user() && Meteor.user().permissions && Meteor.user().permissions.dataImports) {
            if (!_.contains(Meteor.user().permissions.dataImports, "canImportUpgradesDowngrades")) {
                throw new Meteor.Error("no permission to import rating changes")
            } else {
                var _rCh = RatingChanges.findOne({_id: ratingChangeId});
                if (_rCh) {
                    var _newSymbol = _rCh.symbol + "_deleted";
                    RatingChanges.update(
                        {_id: ratingChangeId},
                        {$set: {
                            symbol: _newSymbol
                        }}
                    );
                }
            }
        }
    },

    importPortfolioItems: function(importObj) {
        var _importedIds = [];
        var _duplicatesArr = [];

        var _user = Meteor.user();
        if (!_user) {
            throw new Meteor.Error("Please log in to import portfolio items.");
        } else {
            var _dataImportPermissions = _user.permissions && _user.permissions.dataImports;
            var _canImportPortfolioItems = _dataImportPermissions && _dataImportPermissions.indexOf("canImportPortfolioItems") > -1;
            if (!_canImportPortfolioItems) {
                throw new Meteor.Error("You are not allowed to import portfolio items.");
            } else {
                if (!importObj.portfolioName || importObj.portfolioName === "") {
                    throw new Meteor.Error("Please provide a portfolio name.")
                } else {
                    var _portfolios = Portfolios.find({name: {$regex: importObj.portfolioName}}).fetch();
                    if (_portfolios.length === 0) {
                        throw new Meteor.Error("There is no portfolio with the name you provided");
                    } else if (_portfolios.length !== 1) {
                        throw new Meteor.Error("There is more than 1 portfolio with the name you provided.");
                    } else {
                        var _portfolio = _portfolios[0];
                        var _portfolioId = _portfolio._id;

                        // if you're the owner of the portfolio, or it is public, or you've been granted edit
                        // access to the portfolio via PortfolioPermissions, then you can proceed
                        var _canEditPortfolioItemsForPortf =
                            _user._id === _portfolio.ownerId ||
                            !_portfolio.private ||
                            PortfolioPermissions.findOne({userId: _user._id, portfolioId: _portfolioId, view: true});
                        if (!_canEditPortfolioItemsForPortf) {
                            throw new Meteor.Error("You go not have permission to edit this portfolio");
                        } else {
                            if (!(importObj.dateString && importObj.dateString.length === 10)) {
                                throw new Meteor.Error("Please provide a date in the YYYY-MM-DD format.");
                            } else {
                                var _dateString = importObj.dateString;
                                if (!importObj.equalWeight) {
                                    throw new Meteor.Error("Equal weight is the only weight supported so far.")
                                } else {
                                    var _portfolioItems = importObj.portfolioItems;
                                    var _allUniqSymbols = _.uniq(_.pluck(_portfolioItems, "symbol"));
                                    if (!(_portfolioItems.length === _allUniqSymbols.length)) {
                                        throw new Meteor.Error("Please make sure there are no duplicate symbols.");
                                    } else {
                                        var _existingSymbols = Stocks.find(
                                            {_id: {$in: _allUniqSymbols}}, {
                                                fields: { _id: 1 }
                                            }).fetch();
                                        var _unknownSymbols = _.difference(_allUniqSymbols, _.pluck(_existingSymbols, "_id"));
                                        if (_unknownSymbols.length > 0) {
                                            // this will insert unknown symbols if they are in Yahoo Finance
                                            Meteor.call("insertNewStockSymbols", _unknownSymbols);

                                            throw new Meteor.Error("Symbols cannot be recognized: " + JSON.stringify(_unknownSymbols));
                                        } else {
                                            var _weight = 1 / _allUniqSymbols.length;
                                            _.each(_portfolioItems, function(portfolioItem) {
                                                var _newPortfolioItem = {
                                                    symbol: portfolioItem.symbol,
                                                    portfolioId: _portfolioId,
                                                    dateString: _dateString,
                                                };

                                                if (!PortfolioItems.findOne(_newPortfolioItem)) {
                                                    var _newPortfolioItemId = PortfolioItems.insert(_.extend(_newPortfolioItem, {
                                                        weight: _weight
                                                    }));
                                                    _importedIds.push(_newPortfolioItemId);
                                                } else {
                                                    _duplicatesArr.push(portfolioItem.symbol);
                                                }
                                            });

                                            if (_duplicatesArr.length > 0) {
                                                throw new Meteor.Error("These symbols already exist in the portfolio for this date: " + JSON.stringify(_duplicatesArr));
                                            };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Email.send({
            to: Settings.findOne().serverSettings.dataImports.portfolioItems.emailTo,
            from: Settings.findOne().serverSettings.dataImports.portfolioItems.emailFrom,
            subject: "imported portfolio items for: " + _portfolio.name + ". date: " + _dateString,
            text: JSON.stringify({ timeNow: new Date(), symbols: _allUniqSymbols })
        });

        return {numberImported: _importedIds.length};

    },

        importData: function(importData, importType, scheduledDataPullFlag) {
            //run all the checks here

            if (!Meteor.userId() && !['earnings_releases', 'earnings_releases_new'].includes(importType)) {
                throw new Meteor.Error("not-authorized");
            }

            var _result = {};

            var _user = Meteor.user();
            var _userId = Meteor.userId();
            var _permissions = _userId && Meteor.users.findOne(_userId).permissions;
            var _dataImportingPermissions = _permissions && _permissions.dataImports;
            var _upgradesDowngradesImportPermission = _dataImportingPermissions && _dataImportingPermissions.indexOf("canImportUpgradesDowngrades") > -1;
            var _ratingScalesImportPermission = _dataImportingPermissions && _dataImportingPermissions.indexOf("canImportRatingScales") > -1;
            var _portfoliosImportPermission = _dataImportingPermissions && _dataImportingPermissions.indexOf("canImportPortfolios") > -1;

            if (importType === "portfolio" && _portfoliosImportPermission) {
                if (importData.name) {
                    importData.ownerId = _userId;

                    if ( !importData.firmName || importData.firmName === "" ) {
                        importData.researchFirmId = null;
                    } else {
                        // figure out researchFirmId
                        var _researchFirms = ResearchCompanies.find({ name: { $regex: importData.firmName } }).fetch();
                        if (_researchFirms.length === 1) {
                            var _researchFirmId = _researchFirms[0]._id;
                            importData.researchFirmId = _researchFirmId;
                        } else {
                            throw new Meteor.Error("Please specify a unique firm name")
                        }
                    }

                    importData.lastModifiedOn = new Date().toISOString();
                    importData.lastModifiedBy = _userId;
                    importData.ownerName = _user.username;
                    importData = _.omit(importData, "firmName");

                    _result.newPortfolioId = Portfolios.insert(importData);
                } else {
                    throw new Meteor.Error("Please give a name to this portfolio.");
                }
            } else if (importType === "portfolio" && !_portfoliosImportPermission) {
                throw new Meteor.Error("You do not have permission to import portfolios.");
            } else if (importType === "upgrades_downgrades" && _upgradesDowngradesImportPermission) {
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
                    var _universalSymbol = _getUniversalSymbolFromRatingChangeSymbol(importItem.symbol);
                    //check if symbol isn't already in  _checkForEarningsReleasesForTheseSymbols
                    if (_checkForEarningsReleasesForTheseSymbols.indexOf(_universalSymbol) === -1) {
                        _checkForEarningsReleasesForTheseSymbols.push(_universalSymbol);
                    }

                    //first, check if that research company exists
                    var _researchCompany = ResearchCompanies.findOne({name: importItem.researchFirmString});
                    var originalCompanyId;
                    var _researchCompanyId;
                    if (_researchCompany) {
                        _researchCompanyId = _researchCompany._id;
                        if (_researchCompany.type === "alternative") {
                            var mainResearchCompany = _researchCompany.referenceId && ResearchCompanies.findOne(_researchCompany.referenceId);
                            if (mainResearchCompany) {
                                originalCompanyId = _researchCompany._id;
                                _researchCompanyId = mainResearchCompany._id;
                            }
                        }
                    } else {
                        _researchCompanyId = ResearchCompanies.insert({name: importItem.researchFirmString});
                    }

                    //second, get rating scales id so that can check if item already exists in RatingChanges
                    var _ratingScaleObjectForNew = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.newRatingString});
                    var _ratingScaleObjectForOld = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.oldRatingString});


                    var _originalOldRatingString;
                    var _originalNewRatingString;
                    //if any of the two objects not found, try to match it if with a known alternative rating string for that firm
                    if (!_ratingScaleObjectForNew) {
                        var _secondaryNew = RatingScales.findOne({researchFirmId: _researchCompanyId, type: "alternative", ratingString: importItem.newRatingString});
                        if (_secondaryNew && _secondaryNew.referenceRatingScaleId) {
                            _ratingScaleObjectForNew = RatingScales.findOne({_id: _secondaryNew.referenceRatingScaleId});
                            _originalNewRatingString = importItem.newRatingString;
                        }
                    }

                    if (!_ratingScaleObjectForOld) {
                        var _secondaryOld = RatingScales.findOne({researchFirmId: _researchCompanyId, type: "alternative", ratingString: importItem.oldRatingString});
                        if (_secondaryOld && _secondaryOld.referenceRatingScaleId) {
                            _ratingScaleObjectForOld = RatingScales.findOne({_id: _secondaryOld.referenceRatingScaleId});
                            _originalOldRatingString = importItem.oldRatingString;
                        }
                    }


                    if (_ratingScaleObjectForNew && _ratingScaleObjectForOld) {
                        //can try to check if this RatingChanges item already exists. if not then insert it.
                        var _existingRatingChange = RatingChanges.findOne({
                            researchFirmId: _researchCompanyId,
                            symbol: _universalSymbol,
                            newRatingId: _ratingScaleObjectForNew._id,
                            oldRatingId: _ratingScaleObjectForOld._id,
                            dateString: importItem.dateString
                        });
                        if (_existingRatingChange) {
                            _alreadyExistingNum++;
                        } else if (_universalSymbol && importItem.researchFirmString && importItem.dateString && importItem.newRatingString && importItem.oldRatingString) {
                            // can insert
                            var _ratingChange = {
                                date: new Date(importItem.dateString),
                                dateString: importItem.dateString,
                                //dateValue: moment(importItem.dateString).valueOf(),
                                researchFirmId: _researchCompanyId,
                                symbol: _universalSymbol,
                                newRatingId: _ratingScaleObjectForNew._id,
                                oldRatingId: _ratingScaleObjectForOld._id,
                                private: true,
                                addedBy: Meteor.userId(),
                                addedOn: new Date(),
                                source: importItem.source
                            };
                            // if used alternative research company, store the original research company name
                            if (originalCompanyId) {
                                _ratingChange.originalResearchCompanyId = originalCompanyId;
                            }

                            // -----------------------------------------------------------------------------
                            // Determine if there are any irregularities.
                            // console.log("existing r ch: ", _existingRatingChange);
                            // console.log("_prevRatingChange: ", _prevRatingChange);

                            // three cases:
                            // 1) _ratingChange.oldRatingId is the same as _ratingChange.newRatingId
                            // 2) _ratingChange.oldRatingId is different from _prevRatingChange.newRatingId
                            //      special case: after setting the new ratingChange's oldRatingId the 1st or 3rd case becomes true
                            // 3) _ratingChange.oldRatingId matches _prevRatingChange.oldRatingId and
                            // _ratingChange.newRatingId matches _prevRatingChange.newRatingId (exact duplicate of previous rating change)

                            // -----------------------------------------------------------------------------


                            if (_originalOldRatingString || _originalNewRatingString) {
                                _ratingChange.originalRatingStrings = {
                                    old: _originalOldRatingString,
                                    new: _originalNewRatingString
                                };
                            }

                            console.log("adding rating change for universal symbol: ", _universalSymbol);
                            RatingChanges.insert(_ratingChange);
                            Meteor.call("insertNewStockSymbols", [_universalSymbol]);
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
                    Meteor.call("importData", _checkForEarningsReleasesForTheseSymbols, "earnings_releases", false);
                }

                _result.upgradesDowngradesImportStats.total = _numToImport;
                _result.upgradesDowngradesImportStats.new = _newlyImportedNum;
                _result.upgradesDowngradesImportStats.duplicates = _alreadyExistingNum;
                var _destringified = [];
                _result.couldNotFindGradingScalesForTheseUpDowngrades.forEach(function(obj) {
                    _destringified.push(JSON.parse(obj))
                })
                _result.couldNotFindGradingScalesForTheseUpDowngrades = _destringified;

                Email.send({
                    to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                    from: Settings.findOne().serverSettings.ratingsChanges.emailFrom,
                    subject: 'missing rating scales for rating changes import. dates: ' + JSON.stringify(_.uniq(_.pluck(importData, "dateString"))),
                    text: JSON.stringify(_.extend({timeNow: new Date()}, _result))
                });

            } else if (importType === "upgrades_downgrades" && !_upgradesDowngradesImportPermission) {
                _result.noPermissionToImportUpgradesDowngrades = true;
            } else if (importType === 'earnings_releases_new') {
                const settings = Settings.findOne().serverSettings.ratingsChanges;

                if (scheduledDataPullFlag) {
                    Email.send({
                        to: settings.emailTo,
                        from: settings.emailTo,
                        subject: 'getting earnings releases (new)',
                        text: JSON.stringify({
                            hostname: Meteor.absoluteUrl(),
                            timeNow: new Date(),
                        }),
                    });
                };

                let numMatching = 0;
                let numInserted = 0;

                const url = StocksReactServerUtils.earningsReleases.getAllEarningsReleasesUrl();
                const expectedStatusCode = 200;
                const expectedNumberOfColumns = 24;
                const today = moment().format('YYYY-MM-DD');

                try {
                    const response = HTTP.get(url);
                    if (response.statusCode !== expectedStatusCode) {
                        throw new Meteor.Error(`unexpected response code: ${response.statusCode}`);
                    }

                    const columns = response.data.datatable.columns;
                    if (columns.length !== expectedNumberOfColumns) {
                        throw new Meteor.Error(`the number of column definitions is incorrect: ${columns.length}`);
                    }
                    columns.forEach(column => {
                        column.name = column.name.toUpperCase();
                    });

                    const data = response.data.datatable.data;
                    data.forEach((row, rowIndex) => {
                        if (row.length !== expectedNumberOfColumns) {
                            throw new Meteor.Error(`the number of items in the row is incorrect. row idx: ${rowIndex}`);
                        }

                        let objectFromApi = {};
                        columns.forEach((columnDefinition, columnDefinitionIndex) => {
                            const columnName = columnDefinition.name;
                            const columnType = columnDefinition.type;
                            let rowData = row[columnDefinitionIndex];

                            // get rid of dashes and convert to a number to match existing format
                            if (columnType === 'Date' && rowData) {
                                rowData = parseInt(rowData.replace(/-/g, ''));
                            }

                            objectFromApi[columnName] = rowData;
                        });

                        let earningsRelease = {};
                        _.keys(objectFromApi).forEach(rawKey => {
                            const dbKey = _convertQuandlZEAfieldName(rawKey);
                            if (!dbKey) {
                                throw new Meteor.Error(`unknown key: ${rawKey}`);
                            } else {
                                earningsRelease[dbKey] = objectFromApi[rawKey];
                            }
                        });

                        // special cases
                        if (!earningsRelease.asOf) earningsRelease.asOf = today;
                        earningsRelease.symbol = _getUniversalSymbolFromEarningsReleaseSymbol(earningsRelease.symbol);

                        // sanity checks
                        if (!earningsRelease.asOf || !earningsRelease.symbol) {
                            throw new Meteor.Error(`something went wrong: ${rowIndex}`);
                        }

                        const matchingIDs = getMatchingEarningsReleaseIDs(earningsRelease);
                        const lastModified = new Date();
                        if (matchingIDs.length) {
                            // update asOf and lastModified fields
                            matchingIDs.forEach(id => {
                                EarningsReleases.update(id, {$set: {
                                    asOf: earningsRelease.asOf,
                                    lastModified,
                                }});
                                numMatching += 1;
                            });
                        } else {
                            EarningsReleases.insert(_.extend({lastModified, insertedDate: lastModified}, earningsRelease));
                            Meteor.call('insertNewStockSymbols', [earningsRelease.symbol]);
                            numInserted += 1;
                        }
                    });

                    if (scheduledDataPullFlag) {
                        Email.send({
                            to: settings.emailTo,
                            from: settings.emailTo,
                            subject: 'DONE getting earnings releases (new)',
                            text: JSON.stringify({
                                timeNow: new Date(),
                                totalNumRecordsFromTheAPI: data.length,
                                numInserted, numMatching,
                            }),
                        });
                    };
                } catch (error) {
                    const errorString = error.toString();
                    if (scheduledDataPullFlag) {
                        Email.send({
                            to: settings.emailTo,
                            from: settings.emailTo,
                            subject: 'ERROR from getting earnings releases (new)',
                            text: JSON.stringify({
                                timeNow: new Date(), errorString,
                            }),
                        });
                    }
                }
            } else if (importType === "earnings_releases") {
                return;
                console.log("earnings_releases import function called with: ", importData);
                var _earningsReleaseSymbolsRequested = [];

                importData.forEach(function(importItem) {
                    var _universalSymbol = _getUniversalSymbolFromEarningsReleaseSymbol(importItem);
                    var _quandlSymbol = _getEarningsReleaseSymbolFromUniversalSymbol(importItem);

                    if (_canPullAgainFromQuandl(_universalSymbol)) {
                        _earningsReleaseSymbolsRequested.push(_universalSymbol);
                        //TODO check if this earnings release already exists -- check for plus minus 5 days around it
                        var _earningRelease = {
                            symbol: _universalSymbol
                        };


                        var _url = StocksReactServerUtils.earningsReleases.getZeaUrl(_quandlSymbol);
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
                                        var _matchingEarningsReleaseId = _matchingEntryExistsInEarningsReleases(_universalSymbol, _objectFromQuandlMyDbFormat);
                                        _.extend(_earningRelease, _objectFromQuandlMyDbFormat);
                                        var _lastMod = {
                                            lastModified: new Date().toUTCString(),
                                            lastModifiedBy: Meteor.userId()
                                        };
                                        _.extend(_earningRelease, _lastMod);

                                        if (!_matchingEarningsReleaseId) {
                                            console.log("inserting into earningsReleases: ", _earningRelease);
                                            EarningsReleases.insert(_earningRelease);
                                            Meteor.call("insertNewStockSymbols", [_universalSymbol]);
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
                                console.log("error while getting a response from Quandl. Symbol: ", _universalSymbol);
                                var _err = {
                                    message: (error.response.data && error.response.data.quandl_error.message) || (error.response.content && JSON.parse(error.response.content).quandl_error.message) || 'no error response',
                                    asOf: moment(new Date().toISOString()).format("YYYY-MM-DD"),
                                    symbol: _universalSymbol
                                };
                                QuandlDataPullErrors.insert(_err);
                            }
                        });
                    }
                });

                if (scheduledDataPullFlag) {
                    Email.send({
                        to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                        from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                        subject: 'DONE getting earnings releases',
                        text: JSON.stringify({
                            timeNow: new Date(),
                            symbolsRequestedFromQuandl: _earningsReleaseSymbolsRequested
                        })
                    });
                };

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

         m_ticker: Zacks proprietary master ticker or trading symbol

         ticker: Exchange ticker or trading symbol

         comp_name: Zacks abbreviated company name

         comp_name_2: Full proper company name

         exchange: Exchange traded

         currency_code: Currency code

         street_mean_est_qr1: Zacks consensus estimated earnings per share (EPS) for the next fiscal quarter to be reported, calculated as the arithmetic mean of all individual sell-side EPS estimates, using the Zacks Street accounting methodology.

         exp_rpt_date_fr2: Expected report date for the fiscal year after the next fiscal year to be reported (FR2)

         late_last_desc: Late last description - Indicates whether the report is late and by how long. Values in this field will be one of the following for each record: "Not Late", "More than 3 days late", "More than 20 days late" or "Unknown".

         source_desc: Indicates whether the expected report date comes from a company issued confirmation or from a Zacks mathematical algorithm. Values in this field will be one of the following for each record: "Company" or "Estimated". This field only applies to the next expected quarterly report date, EXP_RPT_DATE_QR1 column. Expected report dates for fiscal periods further out are considered "Estimated" if/until company confirmations are received for those dates

         time_of_day_desc: Time of day description - Indicates the time of day when the earnings announcement is expected. Values in this field will be one of the following for each record: "After market close", "Before the open", "During market trading" or "Unknown"

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
        } else if (zeaFieldName === 'M_TICKER') {
            return 'altSymbol';
        } else if (zeaFieldName === 'TICKER') {
            return 'symbol';
        } else if (zeaFieldName === 'COMP_NAME') {
            return 'companyName';
        } else if (zeaFieldName === 'COMP_NAME_2') {
            return 'altCompanyName';
        } else if (zeaFieldName === 'EXCHANGE') {
            return 'exchange';
        } else if (zeaFieldName === 'CURRENCY_CODE') {
            return 'currencyCode';
        } else if (zeaFieldName === 'STREET_MEAN_EST_QR1') {
            return 'streetMeanEstimateNextFiscalQuarter';
        } else if (zeaFieldName === 'EXP_RPT_DATE_FR2') {
            return 'reportDateNextNextFiscalYear';
        } else if (zeaFieldName === 'LATE_LAST_DESC') {
            return 'lateLastDescription';
        } else if (zeaFieldName === 'SOURCE_DESC') {
            return 'sourceDescription';
        } else if (zeaFieldName === 'TIME_OF_DAY_DESC') {
            return 'timeOfDayDescription';
        }

        return _fieldNameToReturn;
    }

    function _matchingEntryExistsInEarningsReleases(_symbol, _objectFromQuandlMyDbFormat) {
        var _matchingEarningReleaseId;
        var _allExistingEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol});
        _allExistingEarningsReleasesForSymbol.forEach(function(existingRelease) {
            var _allFieldsMatch = true;
            for (var key in _objectFromQuandlMyDbFormat) {
                if (key !== "asOf" && _objectFromQuandlMyDbFormat.hasOwnProperty(key) && (!existingRelease.hasOwnProperty(key) || _objectFromQuandlMyDbFormat[key] !== existingRelease[key])) {
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

    function getMatchingEarningsReleaseIDs(earningsRelease) {
        const fieldsToOmit = [
            'asOf',
            'lastModified',
            'lastModifiedBy',
            'insertedDate',
        ];
        const query = _.omit(earningsRelease, fieldsToOmit);
        return EarningsReleases.find(query, {fields: {_id: 1}}).map(({_id})=>_id);
    }

    function _canPullAgainFromQuandl(symbol) {
        var _canPull = false;
        var _canPullFromQuandlEveryNDaysIfPreviousPullWasError = Settings.findOne().serverSettings.quandl.canRepullFromQuandlEveryNDaysIfPreviousPullWasError;

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

        var _lastErrorFromQuandl = QuandlDataPullErrors.findOne({symbol: symbol}, {sort: {asOf: -1}});
        var _lastErrorDateFromQuandl = _lastErrorFromQuandl && _lastErrorFromQuandl.asOf;
        var _format = "YYYYMMDD";
        var _days = "days";


        var _lastPullDoesNotExist = !_lastPullFromQuandl;
        var _lastPullExistsAndAboutTimeToRepull = _lastPullFromQuandl &&
            _canPullFromQuandlEveryNDays &&
            (parseInt(moment(new Date(_lastPullFromQuandl)).add(_canPullFromQuandlEveryNDays + 1, _days).format(_format)) <= _todaysDateInteger);


        if (_lastPullDoesNotExist || _lastPullExistsAndAboutTimeToRepull ) {
            //great. this means that can pull again based on previous pull history

            var _previousErrorDoesNotExist = !_lastErrorDateFromQuandl;
            var _previousErrorExistsAndItsAboutTimeToRetry = _lastErrorDateFromQuandl && parseInt(moment(new Date(_lastErrorDateFromQuandl)).add(_canPullFromQuandlEveryNDaysIfPreviousPullWasError + 1, _days).format(_format)) <= _todaysDateInteger;
            //now make sure that there were no latest error that would prevent us from pulling again
            if (_previousErrorDoesNotExist || _previousErrorExistsAndItsAboutTimeToRetry) {_canPull = true;}
        }

        return _canPull;
    };

    function _getEarningsReleaseSymbolFromUniversalSymbol(universalSymbol) {
        var _query = {from: 'earnings_release', universalSymbolStr: universalSymbol};

        if (SymbolMappings.find(_query).count() === 1) {
            return SymbolMappings.findOne(_query).symbolStr;
        } else {
            return universalSymbol;
        }
    };

    function _getUniversalSymbolFromEarningsReleaseSymbol(earnRelSymbol) {
        var _query = {
            from: 'earnings_release',
            symbolStr: earnRelSymbol
        };
        if (SymbolMappings.find(_query).count() === 1) {
            return SymbolMappings.findOne(_query).universalSymbolStr;
        } else {
            return earnRelSymbol;
        }
    };

    function _getUniversalSymbolFromRatingChangeSymbol(ratingChangeSymbol) {
        var _query = {
            from: 'rating_change',
            symbolStr: ratingChangeSymbol
        };
        if (SymbolMappings.find(_query).count() === 1) {
            return SymbolMappings.findOne(_query).universalSymbolStr;
        } else {
            return ratingChangeSymbol;
        }
    };