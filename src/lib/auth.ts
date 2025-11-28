/** NextAuth configuration */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            console.log('Missing credentials')
            return null
          }

          console.log('Attempting to authenticate user:', credentials.username)

          const manager = await prisma.manager.findUnique({
            where: { username: credentials.username },
          })

          if (!manager) {
            console.log('User not found:', credentials.username)
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            manager.passwordHash
          )

          if (!isPasswordValid) {
            console.log('Invalid password for user:', credentials.username)
            return null
          }

          console.log('Authentication successful for user:', credentials.username)
          return {
            id: manager.id,
            name: manager.name,
            username: manager.username,
          }
        } catch (error) {
          console.error('Authentication error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.username = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
}
