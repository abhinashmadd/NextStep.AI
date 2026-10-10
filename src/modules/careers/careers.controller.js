const { careerList } = require("./careers.data");
const { sendJson } = require("../../utils/apiResponse");

function getCareers(request, response) {
  sendJson(response, 200, { careers: careerList });
}

module.exports = {
  getCareers,
};
