const { Allstaff, Bank, Inflow } = require("../Model/staffmodel");
const responseController = require("../Utils/responses");

// Send Query API

exports.sendQueryToStaff = async (req, res) => {
    try {
        const { name, queryText, notes } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Create a new query object
        const query = {
            queryText,
            createdAt: new Date(),
            notes: notes || null,
            status: 'unresolved',
            replies: [
                {
                    message: `HR created a query: ${queryText}`, // Adding the HR reply
                    senderRole: 'hr', // Indicate the sender as HR
                    createdAt: new Date() // Timestamp for the reply
                }
            ] // Start with a reply from HR
        };

        // Add the query to the staff's queries array
        staff.queries.push(query);

        // Save the staff document with the new query
        await staff.save();

        return responseController.successResponse(res, 'Query sent successfully', staff.queries);
    } catch (error) {
        return responseController.errorResponse(res, 'Error sending query', error);
    }
};


exports.removeQueryFromStaff = async (req, res) => {
    try {
        const { name, queryId } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Find the query to be removed
        const query = staff.queries.id(queryId);
        if (!query) {
            return responseController.errorResponse(res, 'Query not found', null, 404);
        }

        // Mark the query as resolved
        if (query.status !== 'resolved') {
            query.status = 'resolved';
            query.resolvedAt = new Date();
        }

        // Remove the query from the staff's queries array
        staff.queries.pull(queryId);  // This removes the query by its ID

        // Save the updated staff document
        await staff.save();

        return responseController.successResponse(res, 'Query marked as resolved and removed successfully', staff.queries);
    } catch (error) {
        return responseController.errorResponse(res, 'Error removing query', error);
    }
};



// Get Staff Queries API

exports.getStaffQueries = async (req, res) => {

    try {
        const { name } = req.params;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Return the list of queries for this staff member
        return responseController.successResponse(res, 'Queries retrieved successfully', staff.queries);
    } catch (error) {
        return responseController.errorResponse(res, 'Error retrieving queries', error);
    }
};


exports.respondToQuery = async (req, res) => {

    try {
        const { name, queryId, message } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Find the specific query by ID
        const query = staff.queries.id(queryId);
        if (!query) {
            return responseController.errorResponse(res, 'Query not found', null, 404);
        }

                // Create a reply object
                const reply = {
                    sender: name,  // Assuming 'HR' as sender
                    message,
                    senderRole: 'staff',
                    timestamp: new Date()
                };
        
                // Add the reply to the query's replies array
                query.replies.push(reply);

        // If this is the first reply, change the query status to "resolved"
        // if (query.status === 'unresolved') {
        //     query.status = 'resolved';
        //     query.resolvedAt = new Date();
        // }

        // Save the updated staff document
        await staff.save();

        return responseController.successResponse(res, 'Reply added successfully', query);
    } catch (error) {
        return responseController.errorResponse(res, 'Error responding to query', error);
    }
};


exports.hrRespondToQuery = async (req, res) => {
    try {
        const { name, queryId, message } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Find the specific query by ID
        const query = staff.queries.id(queryId);
        if (!query) {
            return responseController.errorResponse(res, 'Query not found', null, 404);
        }

        // Create a reply object
        const reply = {
            sender: 'HR',  // Assuming 'HR' as sender
            message,
            senderRole: 'hr',
            timestamp: new Date()
        };

        // Add the reply to the query's replies array
        query.replies.push(reply);

        // If the query was unresolved, mark it resolved
        // if (query.status === 'unresolved') {
        //     query.status = 'resolved';
        //     query.resolvedAt = new Date();
        // }

        // Save the updated staff document
        await staff.save();

        return responseController.successResponse(res, 'HR reply added successfully', query);
    } catch (error) {
        return responseController.errorResponse(res, 'Error responding to query', error);
    }
};


// Get Replies for Specific Query API
exports.getQueryReplies = async (req, res) => {

    try {
        const { name, queryId } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Find the specific query by ID
        const query = staff.queries.id(queryId);
        if (!query) {
            return responseController.errorResponse(res, 'Query not found', null, 404);
        }

        // Return the replies for this specific query
        return responseController.successResponse(res, 'Replies retrieved successfully', query.replies);
    } catch (error) {
        return responseController.errorResponse(res, 'Error retrieving replies', error);
    }
};


