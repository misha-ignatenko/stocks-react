import React, { useState } from "react";

import UpDownGradesJSONDataImport from "./UpDownGradesJSONDataImport.jsx";
import ImportRatingScales from "./ImportRatingScales.jsx";

const RATING_SCALES_TAB = "Rating Scales";
const RATING_CHANGES_TAB = "Rating Changes";

function DataImportsMain() {
    const [selectedTab, setSelectedTab] = useState("");

    const selectTab = (tabName) => {
        setSelectedTab(tabName);
    };

    const _b = "btn btn-light";
    const _ab = "btn btn-light active";

    return (
        <div className="container DataImportsMainDiv">
            <div className="btn-group" role="group" aria-label="...">
                <button
                    type="button"
                    className={selectedTab === RATING_SCALES_TAB ? _ab : _b}
                    onClick={() => selectTab(RATING_SCALES_TAB)}
                >
                    {RATING_SCALES_TAB}
                </button>
                <button
                    type="button"
                    className={selectedTab === RATING_CHANGES_TAB ? _ab : _b}
                    onClick={() => selectTab(RATING_CHANGES_TAB)}
                >
                    {RATING_CHANGES_TAB}
                </button>
            </div>

            {selectedTab === RATING_SCALES_TAB && <ImportRatingScales />}
            {selectedTab === RATING_CHANGES_TAB && (
                <UpDownGradesJSONDataImport />
            )}
        </div>
    );
}

export default DataImportsMain;
