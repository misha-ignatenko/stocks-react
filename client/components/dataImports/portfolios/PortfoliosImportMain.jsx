import React, { Component } from 'react';

import ExistingPortfolioImport from './ExistingPortfolioImport.jsx';
import NewPortfolioImport from './NewPortfolioImport.jsx';

export default class PortfoliosImport extends Component {
    constructor(props) {
        super(props);

        this.state = {
            newPortfolio: false,
            selectedPortfolioId: null
        };

        this.selectTab = this.selectTab.bind(this);
    }

    selectTab(e) {
        this.setState({
            newPortfolio: !this.state.newPortfolio
        });
    }

    newPortfolioCreated(newPortfolioId) {
        console.log("inside newPortfolioCreated in portfolios main");
        console.log("new portfolio id: ", newPortfolioId);
        this.setState({
            selectedPortfolioId: newPortfolioId,
            newPortfolio: false
        });
    }

    render() {
        let _b = "btn btn-lg btn-light";
        let _ab = "btn btn-lg btn-light active";

        return (<div className="container">
            <div className="btn-group" role="group" aria-label="...">
                <button type="button" className={this.state.newPortfolio ? _ab : _b} onClick={this.selectTab}>New portfolio</button>
                <button type="button" className={!this.state.newPortfolio ? _ab : _b} onClick={this.selectTab}>Portfolio items</button>
            </div>

            {this.state.newPortfolio ? <NewPortfolioImport onNewPortfolioCreate={this.newPortfolioCreated} /> : <ExistingPortfolioImport portfolioId={this.state.selectedPortfolioId} />}
        </div>);
    }
}