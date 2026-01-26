import React, { Component } from 'react';

import UpDownGradesJSONDataImport from './UpDownGradesJSONDataImport.jsx';
import ImportRatingScales from './ImportRatingScales.jsx';

var _ratingScalesImportTabName = "Rating Scales";
var _ratingChangesImportTabName = "Rating Changes";

export default class DataImportsMain extends Component {

    constructor(props) {
        super(props);

        this.state = {
            selectedTab: ""
        };

        this.selectTab = this.selectTab.bind(this);
    }

    selectTab(e) {
        let _clickedTabName = $(e.target).attr("id");
        this.setState({
            selectedTab: _clickedTabName
        });
    }

    render() {
        let _b = "btn btn-light";
        let _ab = "btn btn-light active";

        return (
            <div className="container DataImportsMainDiv">
                <div className="btn-group" role="group" aria-label="...">
                    <button type="button" className={this.state.selectedTab === _ratingScalesImportTabName ? _ab : _b} id={_ratingScalesImportTabName} onClick={this.selectTab}>{_ratingScalesImportTabName}</button>
                    <button type="button" className={this.state.selectedTab === _ratingChangesImportTabName ? _ab : _b} id={_ratingChangesImportTabName} onClick={this.selectTab}>{_ratingChangesImportTabName}</button>
                </div>

                {this.state.selectedTab === _ratingScalesImportTabName ? <ImportRatingScales /> : null}
                {this.state.selectedTab === _ratingChangesImportTabName ? <UpDownGradesJSONDataImport /> : null}
            </div>
        );
    }
}
