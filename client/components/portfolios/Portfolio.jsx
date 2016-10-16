Portfolio = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            startDate: "2014-09-01",
            endDate: "2016-09-01"
        };
    },

    propTypes: {
        portfolioId: React.PropTypes.string.isRequired
    },

    getMeteorData() {
        let _portfId = this.props.portfolioId;

        let _data = {};

        if (Meteor.subscribe("getPortfolioById", _portfId).ready()) {
            _data.portfolio = Portfolios.findOne({_id: _portfId});

            if (Meteor.subscribe("portfolioItems", [_data.portfolio._id], this.state.startDate, this.state.endDate).ready()) {
                let _portfItems = PortfolioItems.find({portfolioId: _data.portfolio._id}).fetch();
                _data.portfolioItems = _portfItems;
                let _uniqStockSymbols = _.uniq(_.pluck(_portfItems, "symbol"));
                let _uniqPortfItemDates = _.uniq(_.pluck(_portfItems, "dateString"));
                _data.uniqPortfItemDates = _uniqPortfItemDates;

                if (Meteor.subscribe("stockPricesFor", _uniqStockSymbols, this.state.startDate, this.state.endDate).ready()) {
                    _data.stockPrices = NewStockPrices.find({symbol: {$in: _uniqStockSymbols}}).fetch();

                    console.log("portfolio name: ", _data.portfolio.name);
                    console.log("portfolio items: ", _data.portfolioItems.length);
                    console.log("stock prices length: ", _data.stockPrices.length);
                }
            }
        }

        return _data;
    },

    renderPortfolioPerformance() {
        // check if there is enough price data in the date range to generate performance
        let _uniqDates = this.data.uniqPortfItemDates;
        console.log("uniq dates: ", _uniqDates);

        return <div className="container">not enough price history</div>
    },

    shouldComponentUpdate(nextProps, nextState) {
        return this.props.portfolioId !== nextProps.portfolioId;
    },

    render() {
        return (
            <div className="container">
                {this.data.portfolio ?
                    (this.data.portfolioItems ?
                        ( this.data.stockPrices ?
                            <div>
                                <h1>{this.data.portfolio.name}</h1>
                                {this.renderPortfolioPerformance()}
                            </div> :
                            "GETTING STOCK PRICES"
                        ) :
                        "GETTING PORTFOLIO ITEMS") :
                    "GETTING PORTFOLIO INFO"}
            </div>
        );
    }
});