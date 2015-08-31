PickList = React.createClass({
    propTypes: {
        pickList: React.PropTypes.object.isRequired,
        showPrivateButton: React.PropTypes.bool.isRequired
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

    render() {
        const pickListClassName = (this.props.pickList.checked ? "checked" : "") + " " +
            (this.props.pickList.private ? "private" : "");

        return (
            <li className={pickListClassName}>
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

                <span className="text">
                    <strong>{this.props.pickList.addedByUsername}</strong>: {this.props.pickList.listName}
                </span>
            </li>
        );
    }
});