import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { Table } from "reactstrap";
import { Utils } from "../../lib/utils";

export const EarningsReleasesForSymbol = () => {
    const [symbol, setSymbol] = useState("");
    const [releases, setReleases] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const s = symbol.trim();
        if (!s) return;
        setLoading(true);
        setReleases(null);
        Meteor.call(
            "getEarningsReleasesForSymbol",
            { symbol: s },
            (err, res) => {
                setLoading(false);
                if (!err) setReleases(res);
            },
        );
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="mb-3">
                <div className="d-flex align-items-center gap-2">
                    <input
                        type="text"
                        className="form-control"
                        style={{ maxWidth: 200 }}
                        placeholder="Symbol"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary">
                        Search
                    </button>
                </div>
            </form>

            {loading && "Loading..."}

            {releases !== null &&
                !loading &&
                (releases.length ? (
                    <div>
                        <button
                            type="button"
                            className="btn btn-light mb-2"
                            onClick={() =>
                                Utils.download_table_as_csv(
                                    "earningsReleasesForSymbol",
                                )
                            }
                        >
                            Export as a CSV
                        </button>
                        <div style={{ overflowX: "auto" }}>
                            <Table
                                id="earningsReleasesForSymbol"
                                bordered
                                size="sm"
                            >
                                <thead>
                                    <tr>
                                        <th>Inserted</th>
                                        <th>As Of</th>
                                        <th>Report Date</th>
                                        <th>Time of Day</th>
                                        <th>Source Flag</th>
                                        <th>Source Desc</th>
                                        <th>Company</th>
                                        <th>Alt Company</th>
                                        <th>Alt Symbol</th>
                                        <th>Exchange</th>
                                        <th>Currency</th>
                                        <th>FQ End</th>
                                        <th>FY End</th>
                                        <th>EPS Est.</th>
                                        <th>Street Est.</th>
                                        <th>Prior Yr EPS</th>
                                        <th>Prior Qtr EPS</th>
                                        <th>Prior Qtr End</th>
                                        <th>1Y Ago Qtr End</th>
                                        <th>Num Est.</th>
                                        <th>Market Cap</th>
                                        <th>Next Next Rpt</th>
                                        <th>Next FY Rpt</th>
                                        <th>Next Next FY Rpt</th>
                                        <th>Late Flag</th>
                                        <th>Late Desc</th>
                                        <th>Last Yr Rpt Dt</th>
                                        <th>Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {releases.map((e, i) => (
                                        <tr key={e._id || i}>
                                            <td>{e.insertedDateStr ?? ""}</td>
                                            <td>{e.asOf ?? ""}</td>
                                            <td>
                                                {e.reportDateNextFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>{e.timeOfDay ?? ""}</td>
                                            <td>{e.reportSourceFlag ?? ""}</td>
                                            <td>{e.sourceDescription ?? ""}</td>
                                            <td>{e.companyName ?? ""}</td>
                                            <td>{e.altCompanyName ?? ""}</td>
                                            <td>{e.altSymbol ?? ""}</td>
                                            <td>{e.exchange ?? ""}</td>
                                            <td>{e.currencyCode ?? ""}</td>
                                            <td>
                                                {e.endDateNextFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.endDateMostRecentFiscalYear ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.epsMeanEstimateNextFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.streetMeanEstimateNextFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.epsActualOneYearAgoFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.epsActualPreviousFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.endDatePreviousFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.endDateOneYearAgoFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>{e.numEstimates ?? ""}</td>
                                            <td>{e.marketCap ?? ""}</td>
                                            <td>
                                                {e.reportDateNextNextFiscalQuarter ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.reportDateNextFiscalYear ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.reportDateNextNextFiscalYear ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.lateMostRecentReportFlag ??
                                                    ""}
                                            </td>
                                            <td>
                                                {e.lateLastDescription ?? ""}
                                            </td>
                                            <td>{e.lastYearRptDt ?? ""}</td>
                                            <td>{e.source ?? ""}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <h3>
                        No earnings releases found for {symbol.toUpperCase()}.
                    </h3>
                ))}
        </div>
    );
};
