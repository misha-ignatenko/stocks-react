DataImportsMain = React.createClass({

    getInitialState() {
        return {
            showEarningReleasesImportTab: false,
            showRatingScalesImportTab: false,
            showRatingChangesImportTab: false
        }
    },
    selectTab(e) {
        let showEarningReleasesImportTab = e.target.getAttribute("data-tag") === "earningsReleases";
        let showRatingScalesImportTab = e.target.getAttribute("data-tag") === "ratingScales";
        let showRatingChangesImportTab = e.target.getAttribute("data-tag") === "ratingChanges";
        this.setState({
            showEarningReleasesImportTab: showEarningReleasesImportTab,
            showRatingScalesImportTab: showRatingScalesImportTab,
            showRatingChangesImportTab: showRatingChangesImportTab
        });
    },

    render() {
        return (
            <div className="container DataImportsMainDiv">
                <ul className="nav nav-tabs">
                    <li className="tab1"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="earningsReleases">Earnings Releases</a></li>
                    <li className="tab2"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="ratingScales">Rating Scales</a></li>
                    <li className="tab3"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="ratingChanges">Rating Changes</a></li>
                </ul>

                {this.state.showEarningReleasesImportTab ? <EarningsReleasesJSONDataImport /> : null}
                {this.state.showRatingScalesImportTab ? <ImportRatingScales /> : null}
                {this.state.showRatingChangesImportTab ? <UpDownGradesJSONDataImport /> : null}
            </div>
        );
    }
});