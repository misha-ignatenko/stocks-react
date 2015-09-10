PickList = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            showStockEntryPage: false,
            hidePickListItems: true,
            showGraph: true,
            stocksToGraph: []
        };
    },

    propTypes: {
        pickList: React.PropTypes.object.isRequired,
        showPrivateButton: React.PropTypes.bool.isRequired
    },

    getMeteorData() {
        let _pickListsQuery = {
            pickListId: this.props.pickList._id
        };

        return {
            pickListItems: PickListItems.find(_pickListsQuery).fetch(),
            pickListItemsCount: PickListItems.find(_pickListsQuery).count()
        }
    },

    toggleChecked() {
        Meteor.call("setChecked", this.props.pickList._id, ! this.props.pickList.checked);
    },

    deleteThisPickList() {
        Meteor.call("removePickList", this.props.pickList._id);
    },

    togglePrivate() {
        Meteor.call("setPrivate", this.props.pickList._id, ! this.props.pickList.private);
    },

    toggleHidePickListItems() {
        this.setState({
            hidePickListItems: !this.state.hidePickListItems
        });
    },

    showStockEntryPageAction() {
        this.setState({
            showStockEntryPage: !this.state.showStockEntryPage
        });
    },

    renderPickListItems() {
        return this.data.pickListItems.map((pickListItem) => {
            const showPickListItem = pickListItem.pickListId === this.props.pickList._id;

            return <PickListItem
                key={pickListItem._id}
                pickListItem={pickListItem}
                showPickListItem={showPickListItem}
                stockToGraphAddition={this.stockToGraphAddition} />;
        });
    },

    stockToGraphAddition: function(stockToShowObj) {
        console.log("need to add the following symbol to pick list state (stocksToGraph):", stockToShowObj);
        if (stockToShowObj.shouldBeGraphed) {
            let _allStocksToGraphSoFar = this.state.stocksToGraph;
            //now need to either add the stockId if it's not in the array already
            let _findStock = _.find(_allStocksToGraphSoFar, function(stockId) {
                return stockId === stockToShowObj.stockId;
            });
            if (!_findStock) {
                _allStocksToGraphSoFar.push(stockToShowObj.stockId);
                this.setState({
                    stocksToGraph: _allStocksToGraphSoFar
                });
            }
        } else {
            //make sure to remove the stock
            let _allStocksToGraphSoFar = this.state.stocksToGraph;
            let _findStock = _.find(_allStocksToGraphSoFar, function(stockId) {
                return stockId === stockToShowObj.stockId;
            });
            if (_findStock) {
                console.log("need to remove this stock from stocks to graph list: ", stockToShowObj.stockId);
                let _newList = _.reject(_allStocksToGraphSoFar, function(stockId) {
                    return stockId === stockToShowObj.stockId;
                });
                console.log("new list: ", _newList);
                this.setState({
                    stocksToGraph: _newList
                });
            }
        }

        console.log("now the list of stocks to be graphes is: ", this.state.stocksToGraph);
    },

    render() {
        const pickListClassName = (this.props.pickList.checked ? "checked" : "") + " " +
            (this.props.pickList.private ? "private" : "");
        let _stuffToGraph = [];

        return (
            <div className={pickListClassName}>
                <button className="delete" onClick={this.deleteThisPickList}>
                    &times;
                </button>

                <input
                    type="checkbox"
                    readOnly={true}
                    checked={this.props.pickList.checked}
                    onClick={this.toggleChecked}/>

                { this.props.showPrivateButton ? (
                    <button className="toggle-private" onClick={this.togglePrivate}>
                        { this.props.pickList.private ? "Private" : "Public" }
                    </button>
                ) : ''}
                <br/>
                <br/>

                { this.state.showGraph ? (
                    <StocksGraph
                        stuffToGraph={_stuffToGraph} />
                ) : null}

                stocks to graph reactively: { this.state.stocksToGraph }

                <br/>
                <br/>
                <button className="btn btn-default" onClick={this.toggleHidePickListItems}>
                    { this.state.hidePickListItems ? "show items" : "hide items" }
                </button>

                <span className="text">
                    <strong>{this.props.pickList.addedByUsername}</strong>: {this.props.pickList.listName}. Stocks ({this.data.pickListItemsCount}):
                    { !this.state.hidePickListItems ? (
                        <div className="pickListItems">{this.renderPickListItems()}</div>
                    ) : ''}
                </span>

                <div className="row">
                    <button className="btn btn-default" onClick={this.showStockEntryPageAction}>enter stocks</button>
                    { this.state.showStockEntryPage ? <PickListStockEntryPage pickListId={this.props.pickList._id} /> : null }
                </div>
                <br/>
                <br/>
            </div>
        );
    }
});