// Response Controller
exports.successResponse = (res, message = 'Success', data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

// Error Response Handler
exports.errorResponse = (res, message = 'An error occurred', error = null, statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error ? error.message : null, // Log error message if provided
    });
};

// Not Found Response Handler
exports.notFoundResponse = (res, message = 'Resource not found') => {
    return res.status(404).json({
        success: false,
        message,
    });
};

// Validation Error Response
exports.validationErrorResponse = (res, message = 'Validation failed', errors = []) => {
    return res.status(400).json({
        success: false,
        message,
        errors, // Include validation error details
    });
};

// Unauthorized Response
exports.unauthorizedResponse = (res, message = 'Unauthorized access') => {
    return res.status(401).json({
        success: false,
        message,
    });
};
