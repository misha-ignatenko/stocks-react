PickListStockEntryPage = React.createClass({
    propTypes: {
        pickListId: React.PropTypes.string.isRequired
    },

    addStockToPickList(event) {
        event.preventDefault();
        var stockId = React.findDOMNode(this.refs.addStockToPickListTextInput).value.trim();
        var _dateAdded = React.findDOMNode(this.refs.addStockToPickListDateInput).value;
        var pickListId = this.props.pickListId;
        Meteor.call("addStockToPickList", pickListId, stockId, _dateAdded);
        React.findDOMNode(this.refs.addStockToPickListTextInput).value = "";
        React.findDOMNode(this.refs.addStockToPickListDateInput).value = "";
    },

    render: function() {
        return (
            <div className="pickListEntryPage">
                <form className="pickListEntryForm" onSubmit={this.addStockToPickList} >
                    <input
                        type="text"
                        ref="addStockToPickListTextInput"
                        placeholder="Type to add new stock to selected pick list" />
                    <input
                        type="date"
                        ref="addStockToPickListDateInput" />
                </form>
            </div>
        );
    }
});