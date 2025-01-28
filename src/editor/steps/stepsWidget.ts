import type { App } from 'obsidian'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import type { BlockProperties } from '../utils'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { createIconElement, parseBlockProperties, parseLayoutProperties } from '../utils'

// Define the toggle effect
export const toggleStepsEdit = StateEffect.define<{ id: string, value: boolean }>()

interface StepData {
  title: string
  content: string
  properties: BlockProperties
}

interface StepsWidgetConfig extends BaseWidgetConfig {
  isEditing: boolean
}

/**
 * StepsWidget represents a custom widget for rendering step-based content in the editor.
 * It extends BaseWidget to provide step functionality with edit/preview modes.
 */
export class StepsWidget extends BaseWidget {
  private readonly steps: readonly StepData[]
  private readonly properties: BlockProperties
  private isEditing: boolean

  constructor(content: string, id: string, isEditing: boolean, app: App) {
    super({ content, id, app })
    this.isEditing = isEditing

    this.properties = this.parseStepsProperties(content)

    this.steps = this.parseSteps(content)
  }

  private parseStepsProperties(content: string): BlockProperties {
    const match = content.match(/^::steps(?:\((.*?)\))?\n?/)

    if (!match)
      return {}

    const stepsLine = `::steps${match[1] ? `(${match[1]})` : ''}`
    const props = parseLayoutProperties(stepsLine)

    return props
  }

  private parseSteps(content: string): readonly StepData[] {
    // Clean the content by removing the ::steps header and closing ::
    const cleanContent = content
      .replace(/^::steps(?:\((.*?)\))?\n?/, '')
      .replace(/\n?::$/, '')

    const steps: StepData[] = []
    const lines = cleanContent.split('\n')
    let currentStep: { title: string, content: string[], properties: BlockProperties } | null = null
    let nestedBlockCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const stepMatch = line.match(/^--step(?:\((.*?)\))?\s*(.*)/)

      if (stepMatch) {
        if (currentStep) {
          steps.push({
            title: currentStep.title,
            content: currentStep.content.join('\n'),
            properties: currentStep.properties,
          })
        }

        // Parse properties from the captured group
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
        if (line.startsWith('::') && !line.startsWith('::steps')) {
          nestedBlockCount++
          currentStep.content.push(line)
        }
        else if (line === '::') {
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

    return Object.freeze(steps)
  }

  eq(other: StepsWidget): boolean {
    return this.id === other.id
      && this.content === other.content
      && this.isEditing === other.isEditing
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-steps-container')

    // Create edit button first
    const editButton = this.createEditButton((e) => {
      // Find the position of this widget in the document
      const widgetPos = view.posAtDOM(container)

      // Find the first --step position
      const content = this.content
      const searchPos = content.indexOf('--step')
      if (searchPos !== -1) {
        // Find the end of the --step line
        const lineEnd = content.indexOf('\n', searchPos)
        if (lineEnd !== -1) {
          // Position cursor at the start of the next line
          const nextLineStart = lineEnd + 1
          const stepPos = widgetPos + nextLineStart

          // Set cursor position and scroll into view
          view.dispatch({
            selection: { anchor: stepPos, head: stepPos },
            effects: EditorView.scrollIntoView(stepPos, {
              y: 'center',
              x: 'nearest',
              yMargin: 50,
              xMargin: 20,
            }),
          })

          // Ensure focus is set on the editor
          view.focus()
        }
      }
    })

    // Add edit button to container first
    container.appendChild(editButton)

    const stepsContainer = document.createElement('div')
    stepsContainer.className = 'ginko-steps-list'

    // Create and append steps one by one to maintain order
    for (let index = 0; index < this.steps.length; index++) {
      const step = this.steps[index]
      const stepElement = document.createElement('div')
      stepElement.className = 'ginko-step-item'

      // Create step number indicator with icon
      const stepNumber = document.createElement('div')
      stepNumber.className = 'ginko-step-number'

      // Handle icon if specified
      const iconName = typeof step.properties.icon === 'string' ? step.properties.icon : null

      if (iconName) {
        createIconElement(iconName).then((iconEl) => {
          if (iconEl) {
            stepNumber.innerHTML = ''
            stepNumber.appendChild(iconEl)
          }
          else {
            stepNumber.textContent = (index + 1).toString()
          }
        }).catch((error) => {
          console.error('Failed to create icon:', error)
          stepNumber.textContent = (index + 1).toString()
        })
      }
      else {
        stepNumber.textContent = (index + 1).toString()
      }

      stepElement.appendChild(stepNumber)

      // Create step content container
      const stepContent = document.createElement('div')
      stepContent.className = 'ginko-step-content'

      // Add click handler for each step
      stepElement.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()

        // Find the position of this widget in the document
        const widgetPos = view.posAtDOM(container)

        // Find the corresponding --step marker and its content start
        const content = this.content
        let searchPos = 0
        let stepPos = widgetPos

        for (let i = 0; i <= index; i++) {
          searchPos = content.indexOf('--step', searchPos)
          if (searchPos !== -1) {
            // Find the end of the --step line
            const lineEnd = content.indexOf('\n', searchPos)
            if (lineEnd !== -1) {
              // Position cursor at the start of the next line
              const nextLineStart = lineEnd + 1
              stepPos = widgetPos + nextLineStart
            }
            searchPos = lineEnd + 1
          }
        }

        // Set cursor to the start of the step content
        view.dispatch({
          selection: { anchor: stepPos, head: stepPos },
          effects: EditorView.scrollIntoView(stepPos, {
            y: 'center',
            x: 'nearest',
            yMargin: 50,
            xMargin: 20,
          }),
        })

        // Ensure focus is set on the editor
        view.focus()
      })

      const markdownChild = new MarkdownRenderChild(stepContent)

      // Render title and content separately
      let contentToRender = ''
      if (step.title) {
        contentToRender += `### ${step.title}\n`
      }
      contentToRender += step.content

      // Render markdown content
      MarkdownRenderer.render(
        this.app,
        contentToRender.trim(),
        stepContent,
        '',
        markdownChild,
      )

      stepContent.querySelectorAll('.edit-block-button').forEach(btn => btn.remove())
      stepElement.appendChild(stepContent)

      // Append step element immediately
      stepsContainer.appendChild(stepElement)
    }

    container.appendChild(stepsContainer)
    return container
  }

  isEditingState(): boolean {
    return this.isEditing
  }
}
