import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import 'bootstrap/dist/css/bootstrap.min.css';

import Portfolio from './portfolios/Portfolio.jsx';

class StocksApp extends Component {
    constructor(props) {
        super(props);

        this.state = {
            selectedPortfolioId: null
            , showPortfolios: true
        };

        this.showHidePortfs = this.showHidePortfs.bind(this);
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

    render() {

        return (
            <div>

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