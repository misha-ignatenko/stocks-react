import { check, Match } from "meteor/check";
import _ from "underscore";
import { Meteor } from "meteor/meteor";
import { Email } from "../email";
import { ServerUtils } from "../utils";
import { Utils } from "../../lib/utils";
import {
    SymbolMappings,
    EarningsReleases,
    EarningsReleasesNasdaqMonitoring,
    ResearchCompanies,
    RatingScales,
    RatingChanges,
} from "../../lib/collections";
var _totalMaxGradingValue = 120;

Meteor.methods({

    async importEarningsReleasesFromNasdaq({ date }) {
        check(date, String); // YYYY-MM-DD
        await Email.send({
            subject: `getting earnings releases (nasdaq, ${date})`,
            text: JSON.stringify({ timeNow: new Date(), date }),
        });
        try {
            const url = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json",
                },
            });
            const json = await response.json();
            const rows = json?.data?.rows ?? [];

            const timeMap = {
                "time-pre-market": 2,
                "time-after-hours": 1,
                "time-during-market": 3,
                "time-not-supplied": 4,
            };
            const monthStrToNum = {
                Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
            };
            const parseEps = (str) => {
                if (!str || str === "N/A") return null;
                const negative = str.startsWith("(");
                const num = parseFloat(str.replace(/[$(),]/g, ""));
                return isNaN(num) ? null : (negative ? -num : num);
            };

            const asOf = Utils.todaysDate();
            const lastModified = new Date();
            const reportDateNextFiscalQuarter = Utils.convertToNumberDate(date);

            let numInserted = 0;
            let numUpdated = 0;
            let numSkipped = 0;
            let numMainInserted = 0;
            let numMainUpdated = 0;

            for (const row of rows) {
                try {
                    const { symbol, time, epsForecast, fiscalQuarterEnding, noOfEsts, lastYearEPS, name } = row;
                    if (!symbol) { numSkipped++; continue; }

                    const reportTimeOfDayCode = timeMap[time];
                    if (reportTimeOfDayCode === undefined) throw new Error(`unknown time value: ${time}`);
                    const epsMeanEstimateNextFiscalQuarter = parseEps(epsForecast);
                    const epsActualOneYearAgoFiscalQuarter = parseEps(lastYearEPS);
                    const numEstimates = noOfEsts === "N/A" ? null : parseInt(noOfEsts);

                    let quarter = null;
                    let year = null;
                    let endDateNextFiscalQuarter = null;
                    if (fiscalQuarterEnding && fiscalQuarterEnding !== "N/A") {
                        const [monthStr, yearStr] = fiscalQuarterEnding.split("/");
                        const monthNum = monthStrToNum[monthStr] ?? null;
                        year = yearStr ? parseInt(yearStr) : null;
                        if (monthNum) {
                            quarter = Math.ceil(monthNum / 3);
                            const lastDay = new Date(year, monthNum, 0).getDate();
                            endDateNextFiscalQuarter = parseInt(`${year}${String(monthNum).padStart(2, "0")}${String(lastDay).padStart(2, "0")}`);
                        }
                    }

                    const record = {
                        symbol,
                        asOf,
                        lastModified,
                        reportDateNextFiscalQuarter,
                        endDateNextFiscalQuarter,
                        reportTimeOfDayCode,
                        epsMeanEstimateNextFiscalQuarter,
                        epsActualOneYearAgoFiscalQuarter,
                        quarter,
                        year,
                        numEstimates: isNaN(numEstimates) ? null : numEstimates,
                        name: name ?? null,
                    };

                    // upsert into monitoring collection
                    const dataQuery = _.omit(record, ["asOf", "lastModified"]);
                    const existing = await EarningsReleasesNasdaqMonitoring.findOneAsync(dataQuery);

                    if (existing) {
                        await EarningsReleasesNasdaqMonitoring.updateAsync(
                            existing._id,
                            { $set: { asOf, lastModified } },
                        );
                        numUpdated++;
                    } else {
                        await EarningsReleasesNasdaqMonitoring.insertAsync({
                            ...record,
                            insertedDate: lastModified,
                            insertedDateStr: asOf,
                        });
                        numInserted++;
                    }

                    // upsert into main EarningsReleases collection
                    const mainRecord = {
                        symbol,
                        asOf,
                        lastModified,
                        reportDateNextFiscalQuarter,
                        endDateNextFiscalQuarter,
                        reportTimeOfDayCode,
                        epsMeanEstimateNextFiscalQuarter,
                        epsActualOneYearAgoFiscalQuarter,
                        companyName: name ?? null,
                        numEstimates: isNaN(numEstimates) ? null : numEstimates,
                        reportSourceFlag: 1,
                        source: "nasdaq",
                    };
                    const matchingIDs = await getMatchingEarningsReleaseIDs(mainRecord);
                    if (matchingIDs.length) {
                        for (const id of matchingIDs) {
                            await EarningsReleases.updateAsync(id, { $set: { asOf, lastModified } });
                        }
                        numMainUpdated++;
                    } else {
                        await EarningsReleases.insertAsync({
                            ...mainRecord,
                            insertedDate: lastModified,
                            insertedDateStr: asOf,
                        });
                        numMainInserted++;
                    }
                } catch (error) {
                    console.log("importEarningsReleasesFromNasdaq entry error", row?.symbol, error.message);
                    numSkipped++;
                }
            }

            const result = { numInserted, numUpdated, numSkipped, numMainInserted, numMainUpdated };
            console.log("importEarningsReleasesFromNasdaq done", result);
            await Email.send({
                subject: `DONE getting earnings releases (nasdaq, ${date})`,
                text: JSON.stringify({ timeNow: new Date(), date, ...result }),
            });
            return result;
        } catch (error) {
            await Email.send({
                subject: `ERROR from getting earnings releases (nasdaq, ${date})`,
                text: JSON.stringify({ timeNow: new Date(), date, errorString: error.toString() }),
            });
        }
    },

    async importEarningsReleases() {
        await Email.send({
            subject: "getting earnings releases (new)",
            text: JSON.stringify({ timeNow: new Date() }),
        });

        let dataCount = 0;
        let numMatching = 0;
        let numInserted = 0;

        const expectedNumberOfColumns = 24;
        const today = Utils.todaysDate();

        try {
            let cursorID;
            const symbolsToInsert = new Set();

            do {
                const url =
                    await ServerUtils.earningsReleases.getAllEarningsReleasesUrl(
                        cursorID,
                    );
                console.log("calling url: ", url);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const json = await response.json();

                const columns = json.datatable.columns;
                if (columns.length !== expectedNumberOfColumns) {
                    throw new Meteor.Error(
                        `the number of column definitions is incorrect: ${columns.length}`,
                    );
                }
                columns.forEach((column) => {
                    column.name = column.name.toUpperCase();
                });

                const data = json.datatable.data;

                dataCount += data.length;
                for (const [rowIndex, row] of data.entries()) {
                    if (row.length !== expectedNumberOfColumns) {
                        throw new Meteor.Error(
                            `the number of items in the row is incorrect. row idx: ${rowIndex}`,
                        );
                    }

                    let objectFromApi = {};
                    columns.forEach(
                        (columnDefinition, columnDefinitionIndex) => {
                            const columnName = columnDefinition.name;
                            const columnType = columnDefinition.type;
                            let rowData = row[columnDefinitionIndex];

                            if (columnType === "Date" && rowData) {
                                rowData = parseInt(rowData.replace(/-/g, ""));
                            }

                            objectFromApi[columnName] = rowData;
                        },
                    );

                    let earningsRelease = {};
                    _.keys(objectFromApi).forEach((rawKey) => {
                        const dbKey = _convertQuandlZEAfieldName(rawKey);
                        if (!dbKey) {
                            throw new Meteor.Error(`unknown key: ${rawKey}`);
                        } else {
                            earningsRelease[dbKey] = objectFromApi[rawKey];
                        }
                    });

                    if (!earningsRelease.asOf) earningsRelease.asOf = today;
                    earningsRelease.symbol =
                        await _getUniversalSymbolFromEarningsReleaseSymbol(
                            earningsRelease.symbol,
                        );

                    if (!earningsRelease.asOf || !earningsRelease.symbol) {
                        throw new Meteor.Error(
                            `something went wrong: ${rowIndex}`,
                        );
                    }

                    const matchingIDs =
                        await getMatchingEarningsReleaseIDs(earningsRelease);
                    const lastModified = new Date();
                    if (matchingIDs.length) {
                        for (const id of matchingIDs) {
                            await EarningsReleases.updateAsync(id, {
                                $set: {
                                    asOf: earningsRelease.asOf,
                                    lastModified,
                                },
                            });
                            numMatching += 1;
                        }
                    } else {
                        await EarningsReleases.insertAsync(
                            _.extend(
                                {
                                    lastModified,
                                    insertedDate: lastModified,
                                    insertedDateStr: earningsRelease.asOf,
                                },
                                earningsRelease,
                            ),
                        );
                        symbolsToInsert.add(earningsRelease.symbol);
                        numInserted += 1;
                    }
                }

                cursorID = json.meta.next_cursor_id;
            } while (cursorID);

            await Meteor.callAsync(
                "insertNewStockSymbols",
                Array.from(symbolsToInsert),
            );

            await Email.send({
                subject: "DONE getting earnings releases (new)",
                text: JSON.stringify({
                    timeNow: new Date(),
                    totalNumRecordsFromTheAPI: dataCount,
                    numInserted,
                    numMatching,
                }),
            });
        } catch (error) {
            await Email.send({
                subject: "ERROR from getting earnings releases (new)",
                text: JSON.stringify({
                    timeNow: new Date(),
                    errorString: error.toString(),
                }),
            });
        }
    },
    importData: async function (importData, importType) {
        check(importType, String);
        //run all the checks here

        if (!Meteor.userId()) {
            throw new Meteor.Error("not-authorized");
        }

        var _result = {};

        const user = await Meteor.userAsync();
        const permissions = user?.permissions;
        const dataImportingPermissions = permissions && permissions.dataImports;
        const upgradesDowngradesImportPermission =
            dataImportingPermissions?.includes("canImportUpgradesDowngrades");
        const ratingScalesImportPermission = dataImportingPermissions?.includes(
            "canImportRatingScales",
        );

        if (
            importType === "upgrades_downgrades" &&
            !upgradesDowngradesImportPermission
        ) {
            throw new Meteor.Error(
                "not-authorized",
                "You do not have permission to import upgrades/downgrades.",
            );
        } else if (importType === "upgrades_downgrades") {
            _result.couldNotFindGradingScalesForTheseUpDowngrades = [];
            _result.upgradesDowngradesImportStats = {};
            var _numToImport = importData.length;
            var _newlyImportedNum = 0;
            var _alreadyExistingNum = 0;
            const symbolsToInsert = new Set();
            for (const importItem of importData) {
                var _universalSymbol =
                    await _getUniversalSymbolFromRatingChangeSymbol(
                        importItem.symbol,
                    );

                //first, check if that research company exists
                var _researchCompany = await ResearchCompanies.findOneAsync({
                    name: importItem.researchFirmString,
                });
                var originalCompanyId;
                var _researchCompanyId;
                if (_researchCompany) {
                    _researchCompanyId = _researchCompany._id;
                    if (_researchCompany.type === "alternative") {
                        var mainResearchCompany =
                            _researchCompany.referenceId &&
                            (await ResearchCompanies.findOneAsync(
                                _researchCompany.referenceId,
                            ));
                        if (mainResearchCompany) {
                            originalCompanyId = _researchCompany._id;
                            _researchCompanyId = mainResearchCompany._id;
                        }
                    }
                } else {
                    _researchCompanyId = await ResearchCompanies.insertAsync({
                        name: importItem.researchFirmString,
                    });
                }

                //second, get rating scales id so that can check if item already exists in RatingChanges
                var _ratingScaleObjectForNew = await RatingScales.findOneAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: importItem.newRatingString,
                });
                var _ratingScaleObjectForOld = await RatingScales.findOneAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: importItem.oldRatingString,
                });

                var _originalOldRatingString;
                var _originalNewRatingString;
                //if any of the two objects not found, try to match it if with a known alternative rating string for that firm
                if (!_ratingScaleObjectForNew) {
                    var _secondaryNew = await RatingScales.findOneAsync({
                        researchFirmId: _researchCompanyId,
                        type: "alternative",
                        ratingString: importItem.newRatingString,
                    });
                    if (_secondaryNew && _secondaryNew.referenceRatingScaleId) {
                        _ratingScaleObjectForNew =
                            await RatingScales.findOneAsync({
                                _id: _secondaryNew.referenceRatingScaleId,
                            });
                        _originalNewRatingString = importItem.newRatingString;
                    }
                }

                if (!_ratingScaleObjectForOld) {
                    var _secondaryOld = await RatingScales.findOneAsync({
                        researchFirmId: _researchCompanyId,
                        type: "alternative",
                        ratingString: importItem.oldRatingString,
                    });
                    if (_secondaryOld && _secondaryOld.referenceRatingScaleId) {
                        _ratingScaleObjectForOld =
                            await RatingScales.findOneAsync({
                                _id: _secondaryOld.referenceRatingScaleId,
                            });
                        _originalOldRatingString = importItem.oldRatingString;
                    }
                }

                if (_ratingScaleObjectForNew && _ratingScaleObjectForOld) {
                    //can try to check if this RatingChanges item already exists. if not then insert it.
                    var _existingRatingChange =
                        await RatingChanges.findOneAsync({
                            researchFirmId: _researchCompanyId,
                            symbol: _universalSymbol,
                            newRatingId: _ratingScaleObjectForNew._id,
                            oldRatingId: _ratingScaleObjectForOld._id,
                            dateString: importItem.dateString,
                        });
                    if (_existingRatingChange) {
                        _alreadyExistingNum++;
                    } else if (
                        _universalSymbol &&
                        importItem.researchFirmString &&
                        importItem.dateString &&
                        importItem.newRatingString &&
                        importItem.oldRatingString
                    ) {
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
                            source: importItem.source,
                        };
                        // if used alternative research company, store the original research company name
                        if (originalCompanyId) {
                            _ratingChange.originalResearchCompanyId =
                                originalCompanyId;
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

                        if (
                            _originalOldRatingString ||
                            _originalNewRatingString
                        ) {
                            _ratingChange.originalRatingStrings = {
                                old: _originalOldRatingString,
                                new: _originalNewRatingString,
                            };
                        }

                        console.log(
                            "adding rating change for universal symbol: ",
                            _universalSymbol,
                        );
                        await RatingChanges.insertAsync(_ratingChange);
                        symbolsToInsert.add(_universalSymbol);
                        _newlyImportedNum++;
                    }
                } else {
                    //add to error object to let user know these rating scales need to be added
                    //Note: both old and new have to exist.
                    var _new = JSON.stringify({
                        researchFirmString: importItem.researchFirmString,
                        ratingString: importItem.newRatingString,
                    });
                    if (
                        _result.couldNotFindGradingScalesForTheseUpDowngrades.indexOf(
                            _new,
                        ) === -1
                    ) {
                        _result.couldNotFindGradingScalesForTheseUpDowngrades.push(
                            _new,
                        );
                    }

                    var _old = JSON.stringify({
                        researchFirmString: importItem.researchFirmString,
                        ratingString: importItem.oldRatingString,
                    });
                    if (
                        _result.couldNotFindGradingScalesForTheseUpDowngrades.indexOf(
                            _old,
                        ) === -1
                    ) {
                        _result.couldNotFindGradingScalesForTheseUpDowngrades.push(
                            _old,
                        );
                    }
                }
            }

            await Meteor.callAsync(
                "insertNewStockSymbols",
                Array.from(symbolsToInsert),
            );

            _result.upgradesDowngradesImportStats.total = _numToImport;
            _result.upgradesDowngradesImportStats.new = _newlyImportedNum;
            _result.upgradesDowngradesImportStats.duplicates =
                _alreadyExistingNum;
            var _destringified = [];
            _result.couldNotFindGradingScalesForTheseUpDowngrades.forEach(
                function (obj) {
                    _destringified.push(JSON.parse(obj));
                },
            );
            _result.couldNotFindGradingScalesForTheseUpDowngrades =
                _destringified;

            const importedDatesStr = _.uniq(_.pluck(importData, "dateString"));
            _result.importedDatesStr = importedDatesStr;

            await Email.send({
                subject:
                    "missing rating scales for rating changes import. dates: " +
                    JSON.stringify(importedDatesStr),
                text: JSON.stringify(
                    _.extend({ timeNow: new Date() }, _result),
                ),
            });
        } else if (
            importType === "grading_scales" &&
            !ratingScalesImportPermission
        ) {
            throw new Meteor.Error(
                "not-authorized",
                "You do not have permission to import rating scales.",
            );
        } else if (importType === "grading_scales") {
            var _allRatings = importData.thresholdStringsArray;
            var _researchFirmString = importData.researchFirmString;
            //get an id of that research company
            var _researchCompany = await ResearchCompanies.findOneAsync({
                name: _researchFirmString,
            });
            var _researchCompanyId;
            if (_researchCompany) {
                _researchCompanyId = _researchCompany._id;
            } else {
                _researchCompanyId = await ResearchCompanies.insertAsync({
                    name: _researchFirmString,
                });
            }

            var _noneOfGradingScalesForThisFirmAlreadyExist = true;
            for (const ratingString of _allRatings) {
                if (
                    await RatingScales.findOneAsync({
                        researchFirmId: _researchCompanyId,
                        firmRatingFullString: ratingString,
                    })
                ) {
                    _noneOfGradingScalesForThisFirmAlreadyExist = false;
                }
            }

            if (_noneOfGradingScalesForThisFirmAlreadyExist) {
                //now eval approx how many points each and insert into collection.
                var _valuePerThreshold = Math.round(
                    _totalMaxGradingValue / _allRatings.length,
                );
                for (const [index, value] of _allRatings.entries()) {
                    await RatingScales.insertAsync({
                        researchFirmId: _researchCompanyId,
                        firmRatingFullString: value,
                        universalScaleValue:
                            index * _valuePerThreshold +
                            Math.round(_valuePerThreshold / 2),
                    });
                }
            }

            var _beforeCoverageInitiatedString =
                importData.beforeCoverageInitiatedString;
            var _coverageDroppedString = importData.coverageDroppedString;
            var _coverageTemporarilySuspendedString =
                importData.coverageTemporarilySuspendedString;
            if (
                !(await RatingScales.findOneAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _beforeCoverageInitiatedString,
                    universalScaleValue: "beforeCoverageInitiatedString",
                }))
            ) {
                await RatingScales.insertAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _beforeCoverageInitiatedString,
                    universalScaleValue: "beforeCoverageInitiatedString",
                });
            }

            if (
                !(await RatingScales.findOneAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _coverageDroppedString,
                    universalScaleValue: "coverageDroppedString",
                }))
            ) {
                await RatingScales.insertAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _coverageDroppedString,
                    universalScaleValue: "coverageDroppedString",
                });
            }

            if (
                _coverageTemporarilySuspendedString &&
                !(await RatingScales.findOneAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _coverageTemporarilySuspendedString,
                    universalScaleValue: "coverageTemporarilySuspendedString",
                }))
            ) {
                await RatingScales.insertAsync({
                    researchFirmId: _researchCompanyId,
                    firmRatingFullString: _coverageTemporarilySuspendedString,
                    universalScaleValue: "coverageTemporarilySuspendedString",
                });
            }
        }

        return _result;
    },
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
    } else if (zeaFieldName === "M_TICKER") {
        return "altSymbol";
    } else if (zeaFieldName === "TICKER") {
        return "symbol";
    } else if (zeaFieldName === "COMP_NAME") {
        return "companyName";
    } else if (zeaFieldName === "COMP_NAME_2") {
        return "altCompanyName";
    } else if (zeaFieldName === "EXCHANGE") {
        return "exchange";
    } else if (zeaFieldName === "CURRENCY_CODE") {
        return "currencyCode";
    } else if (zeaFieldName === "STREET_MEAN_EST_QR1") {
        return "streetMeanEstimateNextFiscalQuarter";
    } else if (zeaFieldName === "EXP_RPT_DATE_FR2") {
        return "reportDateNextNextFiscalYear";
    } else if (zeaFieldName === "LATE_LAST_DESC") {
        return "lateLastDescription";
    } else if (zeaFieldName === "SOURCE_DESC") {
        return "sourceDescription";
    } else if (zeaFieldName === "TIME_OF_DAY_DESC") {
        return "timeOfDayDescription";
    }

    return _fieldNameToReturn;
}

async function getMatchingEarningsReleaseIDs(earningsRelease) {
    const fieldsToOmit = [
        "asOf",
        "lastModified",
        "lastModifiedBy",
        "insertedDate",
        "insertedDateStr",
    ];
    const query = _.omit(earningsRelease, fieldsToOmit);
    return (
        await EarningsReleases.find(query, { fields: { _id: 1 } }).fetchAsync()
    ).map(({ _id }) => _id);
}

async function _getUniversalSymbolFromEarningsReleaseSymbol(earnRelSymbol) {
    var _query = {
        from: "earnings_release",
        symbolStr: earnRelSymbol,
    };
    if ((await SymbolMappings.find(_query).countAsync()) === 1) {
        return (await SymbolMappings.findOneAsync(_query)).universalSymbolStr;
    } else {
        return earnRelSymbol;
    }
}

async function _getUniversalSymbolFromRatingChangeSymbol(ratingChangeSymbol) {
    var _query = {
        from: "rating_change",
        symbolStr: ratingChangeSymbol,
    };
    if ((await SymbolMappings.find(_query).countAsync()) === 1) {
        return (await SymbolMappings.findOneAsync(_query)).universalSymbolStr;
    } else {
        return ratingChangeSymbol;
    }
}
