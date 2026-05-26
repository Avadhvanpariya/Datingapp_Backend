module.exports = (
    res,
    {
        statusCode = 200,
        ...rest
    }
) => {
    return res.status(statusCode).json(rest);
};