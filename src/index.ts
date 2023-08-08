import * as admin from 'firebase-admin'
import {ApolloError, ApolloServer, ValidationError, gql} from 'apollo-server'

const serviceAccount = require('../service-account.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

interface User {
    id: string;
    name: string;
    screenName: string;
    statusesCount: number;
    tweets: Tweet[]
  }
  
  interface Tweet {
    id: string;
    likes: number;
    text: string;
    userId: string;
    user: User
  }

const typeDefs = gql`
    # Twitter User
    type User {
        id: ID!
        screenName: String!
        statusesCount: Int!
        tweets: [Tweets]!
    }

    #A Tweet Oject
    type Tweets {
        id: ID!
        text: String!
        userId: String!
        user: User!
        likes: Int!
    }

    type Query {
        tweets: [Tweets]
        user(id: String!): User
        users: [User]
    }

    type Mutation {
        likeTweet(id: ID!): Tweets
    }
`

const resolvers = {
    User: {
        async tweets(user) {
            try {
                const userTweets = await admin.firestore().collection('tweets').where('userId', '==', user.id).get()
                return userTweets.docs.map(tweet => {
                    return {...tweet.data(), id: tweet.id}
                }) as Tweet[]
            } catch (error) {
                throw new ApolloError(error)
            }
        }
    },
    Tweets: {
        async user(tweet) {
            try {
                const tweetAuthor = await admin.firestore().doc(`users/${tweet.userId}`).get()
                return {...tweetAuthor.data(), id: tweetAuthor.id} as User
            } catch (error) {
                throw new ApolloError(error)
            }
        }
    },
    Query: {
        async tweets () {
            const tweets = await admin.firestore().collection('tweets').get()
            return tweets.docs.map(tweet => {
                return {... tweet.data() as Tweet[], id: tweet.id}
            })
        },
        async user(_: null, args: {id: string}) {
            try {
                const userDoc = await admin.firestore().doc(`users/${args.id}`).get()
                const user = {...userDoc.data(), id: userDoc.id} as User | undefined
                return user || new ValidationError('User ID not found')
            } catch (error) {
                throw new ApolloError(error)
            }
        },
        async users() {
            try {
                const allUsers = await admin.firestore().collection('users').get()
                return allUsers.docs.map((user) => {
                    return {...user.data(), id: user.id}
                })
            } catch (error) {
                throw new ApolloError(error)
            }
        }
    },
    Mutation: {
        likeTweet: async (_, args: {id: string}) => {
            try {
                const tweetRef = admin.firestore().doc(`tweets/${args.id}`)

                let tweetDoc = await tweetRef.get()
                const tweet = tweetDoc.data() as Tweet
                await tweetRef.update({likes: tweet.likes + 1})

                tweetDoc = await tweetRef.get()
                return {... tweetDoc.data(), id: tweetDoc.id}
            } catch (error) {
                throw new ApolloError(error)
            }
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers
})

server.listen({port: 3000}).then(({url}) => {
    console.log(`Server ready at ${url}`)
})