var _earningsReleasesImportTabName = "Earnings Releases";
var _ratingScalesImportTabName = "Rating Scales";
var _ratingChangesImportTabName = "Rating Changes";
var _ratingChangeConsistency = "Rating Changes Consistency";
var _portfolioImportTabName = "Portfolios";

DataImportsMain = React.createClass({

    getInitialState() {
        return {
            selectedTab: ""
        }
    },
    selectTab(e) {
        let _clickedTabName = $(e.target).attr("id");
        this.setState({
            selectedTab: _clickedTabName
        });
    },

    render() {
        let _b = "btn btn-default";
        let _ab = "btn btn-default active";

        return (
            <div className="container DataImportsMainDiv">
                <div className="btn-group" role="group" aria-label="...">
                    <button type="button" className={this.state.selectedTab === _earningsReleasesImportTabName ? _ab : _b} id={_earningsReleasesImportTabName} onClick={this.selectTab}>{_earningsReleasesImportTabName}</button>
                    <button type="button" className={this.state.selectedTab === _ratingScalesImportTabName ? _ab : _b} id={_ratingScalesImportTabName} onClick={this.selectTab}>{_ratingScalesImportTabName}</button>
                    <button type="button" className={this.state.selectedTab === _ratingChangesImportTabName ? _ab : _b} id={_ratingChangesImportTabName} onClick={this.selectTab}>{_ratingChangesImportTabName}</button>
                    <button type="button" className={this.state.selectedTab === _ratingChangeConsistency ? _ab : _b} id={_ratingChangeConsistency} onClick={this.selectTab}>{_ratingChangeConsistency}</button>
                    <button type="button" className={this.state.selectedTab === _portfolioImportTabName ? _ab : _b} id={_portfolioImportTabName} onClick={this.selectTab}>{_portfolioImportTabName}</button>
                </div>

                {this.state.selectedTab === _earningsReleasesImportTabName ? <EarningsReleasesJSONDataImport /> : null}
                {this.state.selectedTab === _ratingScalesImportTabName ? <ImportRatingScales /> : null}
                {this.state.selectedTab === _ratingChangesImportTabName ? <UpDownGradesJSONDataImport /> : null}
                {this.state.selectedTab === _ratingChangeConsistency ? <RatingChangesConsistency /> : null}
                {this.state.selectedTab === _portfolioImportTabName ? <PortfoliosImport /> : null}
            </div>
        );
    }
});