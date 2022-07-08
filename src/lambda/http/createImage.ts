import {APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult} from 'aws-lambda'
import 'source-map-support/register'
import * as AWS from 'aws-sdk'

const uuid = require('uuid')

const docClient = new AWS.DynamoDB.DocumentClient()

const s3 = new AWS.S3({
    signatureVersion: 'v4'
})

const groupsTable = process.env.GROUPS_TABLE
const imagesTable = process.env.IMAGES_TABLE
const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const groupId = event.pathParameters.groupId
    const validGroupId = await groupExists(groupId)

    if (!validGroupId) {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Group does not exist'
            })
        }
    }

    const imageId = uuid.v4()
    const newImage = await insertNewImage(
        imageId,
        groupId,
        JSON.parse(event.body)
    )

    const url = getUploadUrl(imageId)
    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            newItem: newImage,
            uploadUrl: url
        })
    }
}

async function insertNewImage(imageId, groupId, parsedBody) {

    const newImage = {
        imageId: imageId,
        groupId: groupId,
        timestamp: getCurrentTimestamp(),
        ...parsedBody,
        imageUrl: getReadImageUrl(imageId)
    }
    await docClient.put({
        TableName: imagesTable,
        Item: newImage
    }).promise()

    return newImage
}

function getUploadUrl(imageId) {
    return s3.getSignedUrl('putObject', {
        Bucket: bucketName,
        Key: imageId,
        Expires: parseInt(urlExpiration)
    })
}

function getReadImageUrl(imageId) {
    return `https://${bucketName}.s3.amazonaws.com/${imageId}`
}

function getCurrentTimestamp() {
    return (new Date()).toISOString()
}

async function groupExists(groupId: string) {
    const result = await docClient
        .get({
            TableName: groupsTable,
            Key: {
                id: groupId
            }
        })
        .promise()

    console.log('Get group: ', result)
    return !!result.Item
}