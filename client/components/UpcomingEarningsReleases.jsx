import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { NavLink } from "react-router-dom";
import { Table } from "reactstrap";
import { Utils } from "../../lib/utils";

export const UpcomingEarningsReleases = () => {
    const [earningsReleases, setEarningsReleases] = useState(null);
    const [yahooReleases, setYahooReleases] = useState(null);

    const { user, loggingIn } = useTracker(() => ({
        user: Meteor.user({ fields: { registered: 1 } }),
        loggingIn: Meteor.loggingIn(),
    }), []);

    useEffect(() => {
        if (loggingIn) return;
        setEarningsReleases(null);
        setYahooReleases(null);
        Meteor.call("getUpcomingEarningsReleases", (err, res) => {
            if (!err) setEarningsReleases(res);
        });
        Meteor.call("getUpcomingEarningsReleasesYahoo", (err, res) => {
            if (!err) setYahooReleases(res);
        });
    }, [user, loggingIn]);

    const exportCSV = () => {
        Utils.download_table_as_csv("upcomingEarningsReleases");
    };

    const exportYahooCSV = () => {
        Utils.download_table_as_csv("upcomingEarningsReleasesYahoo");
    };

    return (
        <div>
            {earningsReleases === null ? (
                "getting upcoming earnings releases."
            ) : earningsReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={exportCSV}
                    >
                        Export as a CSV
                    </button>
                    {" "}
                    <NavLink to="/contact">Contact Us</NavLink>
                    <br />
                    <br />
                    <Table id="upcomingEarningsReleases" bordered>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time of Day</th>
                                <th>Symbol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earningsReleases.map((e) => (
                                <tr key={e.key}>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{e.timeOfDay}</td>
                                    <td>{e.symbol}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no earnings releases.</h3>
            )}

            <hr />
            <h4>Yahoo Finance (monitoring)</h4>
            {yahooReleases === null ? (
                "getting yahoo earnings releases."
            ) : yahooReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={exportYahooCSV}
                    >
                        Export as a CSV
                    </button>
                    <br />
                    <br />
                    <Table id="upcomingEarningsReleasesYahoo" bordered>
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Company</th>
                                <th>Report Date</th>
                                <th>Is Estimate</th>
                                <th>End Date</th>
                                <th>EPS Est.</th>
                                <th>EPS Prev Qt</th>
                                <th>EPS 1yr Ago</th>
                                <th>As Of</th>
                            </tr>
                        </thead>
                        <tbody>
                            {yahooReleases.map((e) => (
                                <tr key={`${e.reportDateNextFiscalQuarter}-${e.symbol}`}>
                                    <td>{e.symbol}</td>
                                    <td>{e.companyName}</td>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{e.isEarningsDateEstimate ? "Yes" : "No"}</td>
                                    <td>{e.endDateNextFiscalQuarter ?? ""}</td>
                                    <td>{e.epsMeanEstimateNextFiscalQuarter ?? ""}</td>
                                    <td>{e.epsActualPreviousFiscalQuarter ?? ""}</td>
                                    <td>{e.epsActualOneYearAgoFiscalQuarter ?? ""}</td>
                                    <td>{e.asOf}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no yahoo earnings releases.</h3>
            )}
        </div>
    );
};
