PortfoliosImport = React.createClass({
    getInitialState() {
        return {
            newPortfolio: false,
            selectedPortfolioId: null
        }
    },

    selectTab(e) {
        this.setState({
            newPortfolio: !this.state.newPortfolio
        });
    },

    newPortfolioCreated(newPortfolioId) {
        console.log("inside newPortfolioCreated in portfolios main");
        console.log("new portfolio id: ", newPortfolioId);
        this.setState({
            selectedPortfolioId: newPortfolioId,
            newPortfolio: false
        });
    },

    render() {
        let _b = "btn btn-lg btn-default";
        let _ab = "btn btn-lg btn-default active";

        return (<div className="container">
            <div className="btn-group" role="group" aria-label="...">
                <button type="button" className={this.state.newPortfolio ? _ab : _b} onClick={this.selectTab}>New portfolio</button>
                <button type="button" className={!this.state.newPortfolio ? _ab : _b} onClick={this.selectTab}>Portfolio items</button>
            </div>

            {this.state.newPortfolio ? <NewPortfolioImport onNewPortfolioCreate={this.newPortfolioCreated} /> : <ExistingPortfolioImport portfolioId={this.state.selectedPortfolioId} />}
        </div>);
    }
});