PickListItem = React.createClass({

    getInitialState: function() {
        return {
            includeInGraph: false,
            showRemoveDateField: false,
            showRemoveFromPortfolioBtn: true,
            dateRemoved: null
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
    deleteThisPickListItem: function() {
        console.log("deleting portfolio item", this.props.pickListItem._id);
        Meteor.call("removePickListItem", this.props.pickListItem._id, function(error, result) {
            if (!error) {
                console.log("successfully deleter pick list item.");
            }
        });
    },
    showRemoveDateField: function() {
        this.setState({
            showRemoveFromPortfolioBtn: false,
            showRemoveDateField: true
        });
    },
    doRemove: function() {
        var _that = this;
        Meteor.call("removeStockFromPickList", this.props.pickListItem._id, this.state.dateRemoved, function(error, result) {
            if (!error) {
                _that.setState({
                    showRemoveDateField: false,
                    dateRemoved: null
                });
            }
        })
    },
    setDatepickerOptions: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#datePickListItemRemoved').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = moment(new Date(_newVal).toISOString()).format("YYYY-MM-DD");
            _that.setState({
                dateRemoved: _momentDate
            });
        });
    },

    render() {
        const pickListClassName = "pickListItem";
        let _buttonClassName = this.state.includeInGraph ? "btn btn-primary active" : "btn btn-default";

        return (
            <div className={pickListClassName}>

                { this.props.showPickListItem ? (
                    <div>
                        <button className="delete" onClick={this.deleteThisPickListItem}>&times;</button>
                        <button className={_buttonClassName} onClick={this.addToGraph}>
                            <strong>{this.props.pickListItem.stockId}: from {this.props.pickListItem.dateAdded} {this.props.pickListItem.dateRemoved ? <span>to {this.props.pickListItem.dateRemoved}</span> : null}</strong>
                        </button>
                        {this.state.showRemoveFromPortfolioBtn && !this.props.pickListItem.dateRemoved ? <button onClick={this.showRemoveDateField}>remove from portfolio</button> : null}
                        {this.state.showRemoveDateField ?

                        <div className="datepickers" ref={this.setDatepickerOptions}>
                            <input className="datepickerInput" id="datePickListItemRemoved"/>
                        </div> : null}
                        {this.state.dateRemoved ? <button onClick={this.doRemove}>do remove</button> : null}
                        <br/><br/>
                    </div>
                ) : ''}

            </div>
        );
    }
});