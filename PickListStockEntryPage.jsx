PickListStockEntryPage = React.createClass({
    propTypes: {
        pickListId: React.PropTypes.string.isRequired
    },

    addStockToPickList(event) {
        event.preventDefault();
        var stockSymbol = React.findDOMNode(this.refs.textInput).value.trim();
        var pickListId = this.props.pickListId;
        Meteor.call("addStockToPickList", pickListId, stockSymbol);
        React.findDOMNode(this.refs.textInput).value = "";
    },

    render: function() {
        return (
            <div className="pickListEntryPage">
                <h1>PICK LIST STOCK ENTRY PAGE</h1>
                <form className="pickListEntryForm" onSubmit={this.addStockToPickList} >
                    <input
                        type="text"
                        ref="textInput"
                        placeholder="Type to add new stock to selected pick list" />
                </form>
                <h1>end of entry page</h1>
            </div>
        );
    }
});