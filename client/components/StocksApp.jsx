//TODO React is not defined
//var React = require('react-bootstrap');
var _mainTabName = "mainTab";
var _individualStockTabName = "individualStockTab";
var _upcomingEarningsReleasesTabName = "upcomingEarningsReleases";
var _dataImportsTabName = "dataImportsTab";

StocksApp = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            tabNameToShow: _mainTabName
            , selectedPortfolioId: null
            , showPortfolios: true
        }
    },

    getMeteorData() {
        let _data = {
            currentUser: Meteor.user()
        };

        if (Meteor.subscribe("portfolios").ready()) {
            let _allPortfs = Portfolios.find().fetch();
            _data.portfolios = _allPortfs;
        }

        return _data;
    },

    setSelectedPortf(portId) {
        this.setState({
            selectedPortfolioId: portId,
            showPortfolios: false
        });
    },

    renderPortfolios() {
        return this.data.portfolios.map((portfolio) => {
            return <button className="btn btn-default btn-lg" key={portfolio._id} onClick={this.setSelectedPortf.bind(this, portfolio._id)}>{portfolio.name}</button>;
        });
    },

    renderSelectedPortfolio() {
        let _pId = this.state.selectedPortfolioId;

        return _pId ? <Portfolio
            key={_pId}
            portfolioId={_pId}
        /> : <div>SELECT A PORTFOLIO TO SEE PERFORMANCE</div>;
    },

    showHidePortfs() {
        this.setState({
            showPortfolios: !this.state.showPortfolios
        });
    },

    createNewPortfolio(event) {
        event.preventDefault();
        var _name = this.refs.textInput.value.trim();
        var _that = this;
        Meteor.call("createNewPortfolio", _name, function (error, result) {
            _that.refs.textInput.value = "";
        });
    },

    selectTab(e) {
        let _clickedTabName = $(e.target).attr("id");
        this.setState({
            tabNameToShow: _clickedTabName
        });
    },

    render() {
        //add this to tabs to make router work
        //<li className="tab3"><a href="/dataimport/updowngrades">TEST TO UP DOWN GRADES</a></li>
        let _b = "btn btn-default";
        let _ab = "btn btn-default active";
        return (
            <div className="container">
                <header>
                    <AccountsUIWrapper />
                </header>

                <div className="btn-group" role="group" aria-label="...">
                    <button type="button" className={this.state.tabNameToShow === _mainTabName ? _ab : _b} id={_mainTabName} onClick={this.selectTab}>Portfolios</button>
                    <button type="button" className={this.state.tabNameToShow === _individualStockTabName ? _ab : _b} id={_individualStockTabName} onClick={this.selectTab}>Individual Stocks</button>
                    <button type="button" className={this.state.tabNameToShow === _upcomingEarningsReleasesTabName ? _ab : _b} id={_upcomingEarningsReleasesTabName} onClick={this.selectTab}>Upcoming Earnings Releases</button>
                    {this.data.currentUser && this.data.currentUser.showDataImportsTab ? <button type="button" className={this.state.tabNameToShow === _dataImportsTabName ? _ab : _b} id={_dataImportsTabName} onClick={this.selectTab}>Data Imports</button> : null }
                </div>

                { this.state.tabNameToShow === _mainTabName ? (
                    <div>
                        <br/>
                        { this.data.currentUser ?
                            <form className="col-md-4 new-pickList" style={{float: "right"}} onSubmit={this.createNewPortfolio} >
                                <input
                                    style={{width: "100%"}}
                                    type="text"
                                    ref="textInput"
                                    placeholder="Type to add a new portfolio" />
                            </form> : ''
                        }
                        <br/>
                        <br/>
                        <button className="btn btn-default" onClick={this.showHidePortfs}>{this.state.showPortfolios ? "hide portfolios" : "show portfolios"}</button>
                        {this.data.portfolios ? <div className="container">
                            {this.state.showPortfolios ? this.renderPortfolios() : null}
                            {this.renderSelectedPortfolio()}
                        </div> : "GETTING PORTFOLIOS"}
                        <br/>
                    </div>
                ) : null}
                { this.state.tabNameToShow === _individualStockTabName ? (
                    <div>
                        <IndividualStock />
                    </div>
                ) : null}
                { this.state.tabNameToShow === _upcomingEarningsReleasesTabName ? (
                    <div>
                        <UpcomingEarningsReleases />
                    </div>
                ) : null}
                { this.state.tabNameToShow === _dataImportsTabName ? (
                    <div>
                        <DataImportsMain />
                    </div>
                ) : null}
            </div>
        );
    }
});