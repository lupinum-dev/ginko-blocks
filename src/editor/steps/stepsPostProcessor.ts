import type { MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian'
import type { BlockProperties } from '../utils'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { createIconElement, parseBlockProperties } from '../utils'

export const STEPS_REGEX = /\+\+steps(?:\(.*?\))?\n([\s\S]*?)\+\+/g
export const STEP_REGEX = /--step(?:\((.*?)\))?\s*(.*)/

interface StepData {
  title: string
  content: string
  properties: BlockProperties
}

export const stepsProcessor: MarkdownPostProcessor = (element: HTMLElement, context: MarkdownPostProcessorContext) => {
  const elements = Array.from(element.querySelectorAll('p, .ginko-steps-container'))

  let currentSteps: HTMLElement | null = null
  let i = 0

  while (i < elements.length) {
    const el = elements[i]
    const text = el.textContent?.trim() || ''

    if (text.startsWith('++steps')) {
      let foundEnd = false
      currentSteps = createStepsContainer()

      // Handle single-line case
      if (text.includes('++\n') || text.endsWith('++')) {
        const content = text.split('\n')
        processStepsContent(content, currentSteps, context)
        el.replaceWith(currentSteps)
        currentSteps = null
        i++
        continue
      }

      // Handle multi-line case
      let nextElement = el.nextElementSibling
      if (!nextElement && el.parentElement) {
        nextElement = el.parentElement.nextElementSibling
      }

      const stepsContent: string[] = []

      while (nextElement) {
        const siblingText = nextElement.textContent?.trim() || ''
        if (siblingText === '++') {
          foundEnd = true
          nextElement.remove()
          break
        }
        stepsContent.push(siblingText)
        const currentSibling = nextElement
        nextElement = nextElement.nextElementSibling
          || (nextElement.parentElement?.nextElementSibling || null)
        currentSibling.remove()
      }

      if (stepsContent.length > 0) {
        processStepsContent(stepsContent, currentSteps, context)
      }

      el.replaceWith(currentSteps)

      if (foundEnd) {
        currentSteps = null
      }

      i++
      continue
    }

    i++
  }
}

function createStepsContainer(): HTMLElement {
  const container = document.createElement('div')
  container.className = 'ginko-steps-container ginko-embed-block markdown-rendered show-indentation-guide ginko-steps-reading'
  container.setAttribute('contenteditable', 'false')
  container.setAttribute('tabindex', '-1')

  const stepsList = document.createElement('div')
  stepsList.className = 'ginko-steps-list'
  container.appendChild(stepsList)

  return container
}

async function processStepsContent(content: string[], container: HTMLElement, context: MarkdownPostProcessorContext) {
  const stepsList = container.querySelector('.ginko-steps-list')
  if (!stepsList)
    return

  // Clean and parse content
  const cleanContent = content
    .join('\n')
    .replace(/^\+\+steps(?:\((.*?)\))?\n?/, '')
    .replace(/\n?\+\+$/, '')

  const lines = cleanContent.split('\n')
  let currentStep: { title: string, content: string[], properties: BlockProperties } | null = null
  const steps: StepData[] = []
  let nestedBlockCount = 0

  for (const line of lines) {
    const stepMatch = line.match(STEP_REGEX)

    if (stepMatch) {
      if (currentStep) {
        steps.push({
          title: currentStep.title,
          content: currentStep.content.join('\n'),
          properties: currentStep.properties,
        })
      }

      const props = stepMatch[1]
        ? parseBlockProperties(line, /--step\((.*?)\)/)
        : {}

      currentStep = {
        title: stepMatch[2] || '',
        content: [],
        properties: props,
      }
    }
    else if (currentStep) {
      // Track nested blocks
      if (line.startsWith('++') && !line.startsWith('++steps')) {
        nestedBlockCount++
        currentStep.content.push(line)
      }
      else if (line === '++') {
        if (nestedBlockCount > 0) {
          nestedBlockCount--
          currentStep.content.push(line)
        }
      }
      else {
        currentStep.content.push(line)
      }
    }
  }

  if (currentStep) {
    steps.push({
      title: currentStep.title,
      content: currentStep.content.join('\n'),
      properties: currentStep.properties,
    })
  }

  // Render steps
  steps.forEach(async (step, index) => {
    const stepElement = document.createElement('div')
    stepElement.className = 'ginko-step-item'

    // Create step number with icon
    const stepNumber = document.createElement('div')
    stepNumber.className = 'ginko-step-number'

    const iconName = typeof step.properties.icon === 'string' ? step.properties.icon : null
    if (iconName) {
      try {
        const iconEl = await createIconElement(iconName)
        if (iconEl) {
          stepNumber.innerHTML = ''
          stepNumber.appendChild(iconEl)
        }
        else {
          stepNumber.textContent = (index + 1).toString()
        }
      }
      catch (error) {
        console.error('Failed to create icon:', error)
        stepNumber.textContent = (index + 1).toString()
      }
    }
    else {
      stepNumber.textContent = (index + 1).toString()
    }

    stepElement.appendChild(stepNumber)

    // Create and render step content
    const stepContent = document.createElement('div')
    stepContent.className = 'ginko-step-content'

    const markdownChild = new MarkdownRenderChild(stepContent)
    context.addChild(markdownChild)

    // Render title and content separately, keeping markdown in title
    let contentToRender = ''
    if (step.title) {
      contentToRender += `### ${step.title}\n`
    }
    contentToRender += step.content

    await MarkdownRenderer.render(
      this.app,
      contentToRender.trim(),
      stepContent,
      '',
      markdownChild,
    )

    stepContent.querySelectorAll('.edit-block-button').forEach(btn => btn.remove())
    stepElement.appendChild(stepContent)
    stepsList.appendChild(stepElement)
  })
}
