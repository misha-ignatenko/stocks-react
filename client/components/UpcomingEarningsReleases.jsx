import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { NavLink } from "react-router-dom";
import { Table } from "reactstrap";
import { Utils } from "../../lib/utils";

export const UpcomingEarningsReleases = () => {
    const [earningsReleases, setEarningsReleases] = useState(null);

    const { user, loggingIn } = useTracker(() => ({
        user: Meteor.user({ fields: { registered: 1 } }),
        loggingIn: Meteor.loggingIn(),
    }), []);

    useEffect(() => {
        if (loggingIn) return;
        setEarningsReleases(null);
        Meteor.call("getUpcomingEarningsReleases", (err, res) => {
            if (!err) setEarningsReleases(res);
        });
    }, [user, loggingIn]);

    return (
        <div>
            {earningsReleases === null ? (
                "getting upcoming earnings releases."
            ) : earningsReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => Utils.download_table_as_csv("upcomingEarningsReleases")}
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
                                <th>Company</th>
                                <th>Exchange</th>
                                <th>EPS Est.</th>
                                <th>Prior Yr EPS</th>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earningsReleases.map((e) => (
                                <tr key={e.key}>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{e.timeOfDay}</td>
                                    <td>{e.symbol}</td>
                                    <td>{e.companyName ?? ""}</td>
                                    <td>{e.exchange ?? ""}</td>
                                    <td>{e.epsMeanEstimateNextFiscalQuarter ?? ""}</td>
                                    <td>{e.epsActualOneYearAgoFiscalQuarter ?? ""}</td>
                                    <td>{e.source ?? ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no earnings releases.</h3>
            )}
        </div>
    );
};
