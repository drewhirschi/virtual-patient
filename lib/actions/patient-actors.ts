"use server"

import { requireAuth } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

/**
 * Get all patient actors owned by the current user
 */
export async function getMyPatientActors() {
    const user = await requireAuth()

    const patientActors = await prisma.patientActor.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' }
    })

    return patientActors
}

/**
 * Get a single patient actor by ID (with ownership verification)
 */
export async function getPatientActor(id: string) {
    const user = await requireAuth()

    const patientActor = await prisma.patientActor.findUnique({
        where: { id }
    })

    if (!patientActor) {
        throw new Error("Patient actor not found")
    }

    if (patientActor.ownerId !== user.id) {
        throw new Error("Unauthorized: You don't own this patient actor")
    }

    return patientActor
}

/**
 * Create a new patient actor
 */
export async function createPatientActor(data: {
    name: string
    age: number
    prompt: string
    slug?: string
}) {
    const user = await requireAuth()

    // Generate slug from name if not provided
    let slug = data.slug || data.name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

    // Ensure slug is unique
    let counter = 1
    let uniqueSlug = slug
    while (await prisma.patientActor.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`
        counter++
    }

    const patientActor = await prisma.patientActor.create({
        data: {
            name: data.name,
            age: data.age,
            prompt: data.prompt,
            slug: uniqueSlug,
            ownerId: user.id
        }
    })

    return patientActor
}

/**
 * Update a patient actor (with ownership verification)
 */
export async function updatePatientActor(
    id: string,
    data: {
        name?: string
        age?: number
        prompt?: string
        allowSubmissions?: boolean
        demographics?: string
        chiefComplaint?: string
        medicalHistory?: string
        medications?: string
        socialHistory?: string
        personality?: string
        physicalFindings?: string
        additionalSymptoms?: string
        revelationLevel?: string
        stayInCharacter?: boolean
        avoidMedicalJargon?: boolean
        provideFeedback?: boolean
        customInstructions?: string
    }
) {
    const user = await requireAuth()

    // Verify ownership first
    const existingActor = await prisma.patientActor.findUnique({
        where: { id }
    })

    if (!existingActor) {
        throw new Error("Patient actor not found")
    }

    if (existingActor.ownerId !== user.id) {
        throw new Error("Unauthorized: You don't own this patient actor")
    }

    // Proceed with update
    const patientActor = await prisma.patientActor.update({
        where: { id },
        data
    })

    return patientActor
}

/**
 * Delete a patient actor (with ownership verification)
 */
export async function deletePatientActor(id: string) {
    const user = await requireAuth()

    // Verify ownership first
    const existingActor = await prisma.patientActor.findUnique({
        where: { id }
    })

    if (!existingActor) {
        throw new Error("Patient actor not found")
    }

    if (existingActor.ownerId !== user.id) {
        throw new Error("Unauthorized: You don't own this patient actor")
    }

    // Proceed with deletion
    await prisma.patientActor.delete({
        where: { id }
    })

    return { success: true }
}

/**
 * Get a patient actor by slug (public access)
 * No authentication required
 */
export async function getPatientActorBySlug(slug: string) {
    const patientActor = await prisma.patientActor.findUnique({
        where: { slug }
    })

    if (!patientActor) {
        return null
    }

    // Only return if it's public
    if (!patientActor.isPublic) {
        return null
    }

    return patientActor
}

