import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import 'bootstrap/dist/css/bootstrap.min.css';

import AccountsUIWrapper from './AccountsUIWrapper.jsx';
import IndividualStock from './IndividualStock.jsx';
import UpcomingEarningsReleases from './UpcomingEarningsReleases.jsx';
import DataImportsMain from './dataImports/DataImportsMain.jsx';

var _mainTabName = "mainTab";
var _individualStockTabName = "individualStockTab";
var _upcomingEarningsReleasesTabName = "upcomingEarningsReleases";
var _dataImportsTabName = "dataImportsTab";

class StocksApp extends Component {
    constructor(props) {
        super(props);

        this.state = {
            tabNameToShow: _mainTabName
            , selectedPortfolioId: null
            , showPortfolios: true
        };

        this.selectTab = this.selectTab.bind(this);
    }

    setSelectedPortf(portId) {
        this.setState({
            selectedPortfolioId: portId,
            showPortfolios: false
        });
    }

    renderPortfolios() {
        return this.props.portfolios.map((portfolio) => {
            return <button className="btn btn-light btn-lg" key={portfolio._id} onClick={this.setSelectedPortf.bind(this, portfolio._id)}>{portfolio.name}</button>;
        });
    }

    renderSelectedPortfolio() {
        let _pId = this.state.selectedPortfolioId;

        return _pId ? <Portfolio
            key={_pId}
            portfolioId={_pId}
        /> : <div>SELECT A PORTFOLIO TO SEE PERFORMANCE</div>;
    }

    showHidePortfs() {
        this.setState({
            showPortfolios: !this.state.showPortfolios
        });
    }

    createNewPortfolio(event) {
        event.preventDefault();
        var _name = this.refs.textInput.value.trim();
        var _that = this;
        Meteor.call("createNewPortfolio", _name, function (error, result) {
            _that.refs.textInput.value = "";
        });
    }

    selectTab(e) {
        let _clickedTabName = $(e.target).attr("id");
        this.setState({
            tabNameToShow: _clickedTabName
        });
    }

    render() {
        //add this to tabs to make router work
        //<li className="tab3"><a href="/dataimport/updowngrades">TEST TO UP DOWN GRADES</a></li>
        let _b = "btn btn-light";
        let _ab = "btn btn-light active";

        return (
            <div>
                <header>
                    <AccountsUIWrapper />
                </header>

                <div className="btn-group" role="group" aria-label="...">
                    <button type="button" className={this.state.tabNameToShow === _mainTabName ? _ab : _b} id={_mainTabName} onClick={this.selectTab}>Portfolios</button>
                    <button type="button" className={this.state.tabNameToShow === _individualStockTabName ? _ab : _b} id={_individualStockTabName} onClick={this.selectTab}>Individual Stocks</button>
                    <button type="button" className={this.state.tabNameToShow === _upcomingEarningsReleasesTabName ? _ab : _b} id={_upcomingEarningsReleasesTabName} onClick={this.selectTab}>Upcoming Earnings Releases</button>
                    {this.props.currentUser && this.props.currentUser.showDataImportsTab ? <button type="button" className={this.state.tabNameToShow === _dataImportsTabName ? _ab : _b} id={_dataImportsTabName} onClick={this.selectTab}>Data Imports</button> : null }
                </div>

                { this.state.tabNameToShow === _mainTabName ? (
                    <div>
                        <br/>
                        { this.props.currentUser ?
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
                        <button className="btn btn-light" onClick={this.showHidePortfs}>{this.state.showPortfolios ? "hide portfolios" : "show portfolios"}</button>
                        {this.props.portfolios ? <div className="container">
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
}

export default withTracker(() => {

    let _data = {
        currentUser: Meteor.user()
    };

    if (Meteor.subscribe("portfolios").ready()) {
        _data.portfolios = Portfolios.find().fetch();
    }

    return _data;
})(StocksApp);