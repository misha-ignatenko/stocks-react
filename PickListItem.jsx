PickListItem = React.createClass({

    getInitialState: function() {
        return {
            includeInGraph: false
        };
    },

    propTypes: {
        pickListItem: React.PropTypes.object.isRequired,
        showPickListItem: React.PropTypes.bool.isRequired,
        stockToGraphAddition: React.PropTypes.func.isRequired
    },

    addToGraph: function() {


        //set this.props.stockToGraphAddition as object with stockID and whether or not it should  be included
        //later in pickList.jsx verify that the new object is consistent with the stocks to show array of objects

        this.props.stockToGraphAddition({
            stockId: this.props.pickListItem.stockId,
            shouldBeGraphed: !this.state.includeInGraph,
            dateAdded: this.props.pickListItem.dateAdded,
            dateRemoved: this.props.pickListItem.dateRemoved,
            ratingWhenAdded: this.props.pickListItem.ratingWhenAdded
        });

        //first need to set the state of button as active
        this.setState({
            includeInGraph: !this.state.includeInGraph
        });

        //now need to check if stock info is in StockPrices collection for the selected date?
        //then if not call the Yahoo Finance and add data to StockPrices collection
        //add that line to graph
        //use example from web -- graph looks amaze.
    },

    render() {
        const pickListClassName = "pickListItem";
        let _buttonClassName = this.state.includeInGraph ? "btn btn-primary active" : "btn btn-default";

        return (
            <div className={pickListClassName}>

                { this.props.showPickListItem ? (
                    <div className="row btn-group">
                        <button className={_buttonClassName} onClick={this.addToGraph}>
                            <strong>{this.props.pickListItem.stockId}</strong>add charts
                        </button>
                    </div>
                ) : ''}

            </div>
        );
    }
});