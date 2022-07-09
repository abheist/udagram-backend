import * as AWS from "aws-sdk";
import {APIGatewayEventDefaultAuthorizerContext, APIGatewayProxyEventBase} from "aws-lambda";

const docClient = new AWS.DynamoDB.DocumentClient()
const groupsTable = process.env.GROUPS_TABLE
const imagesTable = process.env.IMAGES_TABLE

export async function getImagesForGroup(groupId: string) {
    const response = await docClient.query({
        TableName: imagesTable,
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: {
            ':groupId': groupId
        },
        ScanIndexForward: false
    }).promise()
    return response.Items
}

export async function groupExists(groupId: string) {
    const response = await docClient
        .get({
            TableName: groupsTable,
            Key: {
                id: groupId
            }
        }).promise()
    return !!response.Item
}

const imageIdIndex = process.env.IMAGE_ID_INDEX

export async function get_image(event: APIGatewayProxyEventBase<APIGatewayEventDefaultAuthorizerContext>) {
    const imageId = event.pathParameters.imageId

    return await docClient.query({
        TableName: imagesTable,
        IndexName: imageIdIndex,
        KeyConditionExpression: 'imageId = :imageId',
        ExpressionAttributeValues: {
            ':imageId': imageId
        }
    }).promise()
}

export async function delete_group(event: APIGatewayProxyEventBase<APIGatewayEventDefaultAuthorizerContext>) {
    const id = event.pathParameters.groupId

    return await docClient.delete({
        TableName: groupsTable,
        Key: {id: id}
    }).promise()
}

export async function getGroups() {
    const result = await docClient.scan({
        TableName: groupsTable
    }).promise()

    return result.Items
}

const uuid = require('uuid')

export async function createGroups(event: APIGatewayProxyEventBase<APIGatewayEventDefaultAuthorizerContext>) {
    const itemId = uuid.v4()
    const parsedBody = JSON.parse(event.body)
    const newItem = {
        id: itemId,
        ...parsedBody
    }

    await docClient.put({
        TableName: groupsTable,
        Item: newItem
    }).promise()
    return newItem;
}

const s3 = new AWS.S3({
    signatureVersion: 'v4'
})
const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export async function get_image_with_url(groupId: string, event: APIGatewayProxyEventBase<APIGatewayEventDefaultAuthorizerContext>) {
    const imageId = uuid.v4()
    const newImage = await insertNewImage(
        imageId,
        groupId,
        JSON.parse(event.body)
    )

    const url = getUploadUrl(imageId)
    return {newImage, url};
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