export function requireAdmin(user: User): asserts user is Exclude<User, null> {
  if (!user || user.role !== 'admin') {
    throw new Error('Admin access required')
  }
}
