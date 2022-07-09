import {APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult} from 'aws-lambda'
import 'source-map-support/register'
import {delete_group} from "../../businessLogic/utils";

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    await delete_group(event);

    return {
        statusCode: 204,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: ''
    }
}
