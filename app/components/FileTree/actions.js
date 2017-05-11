import _ from 'lodash'
import api from 'backendAPI'
import { registerAction } from 'utils/actions'
import FileStore from 'commons/File/store'
import * as TabActions from 'components/Tab/actions'
import contextMenuStore from 'components/ContextMenu/store'
import state, { FileTreeNode } from './state'
import bindToFile from './fileTreeToFileBinding'
import FileTreeContextMenuItems from './contextMenuItems'
import { getTabType } from 'utils'

export const initializeFileTree = registerAction('filetree:init', () => {
  FileStore.fetchProjectRoot()
  const FileState = FileStore.getState()
  bindToFile(FileState, FileTreeNode)
})

export const selectNode = registerAction('filetree:select_node',
  (node, multiSelect) => ({ node, multiSelect }),
  ({ node, multiSelect }) => {
    const offset = typeof node === 'number' && node

    if (offset === 1) {
      const curNode = state.focusedNodes.pop()
      if (curNode) node = curNode.getNext
    } else if (offset === -1) {
      const curNode = state.focusedNodes[0]
      if (curNode) node = curNode.getPrev
    }

    if (!node) node = state.root

    if (!multiSelect) {
      state.root.unfocus()
      state.root.forEachDescendant(childNode => childNode.unfocus())
    }

    node.focus()
  }
)

export const highlightDirNode = registerAction('filetree:highlight_dir_node',
  node => node.isDir && node.highlight()
)

export const toggleNodeFold = registerAction('filetree:toggle_node_fold',
  (node, shouldBeFolded, deep) => ({ node, shouldBeFolded, deep }),
  ({ node, shouldBeFolded=null, deep=false }) => {
    if (!node.isDir) return
    const isFolded = _.isBoolean(shouldBeFolded) ? shouldBeFolded : !node.isFolded
    node.toggleFold(isFolded)
    if (deep) {
      node.forEachDescendant(childNode => {
        childNode.toggleFold(isFolded)
      })
    }
  }
)

export const removeNode = registerAction('filetree:remove_node',
  node => state.entities.delete(node.id)
)

export const openContextMenu = contextMenuStore.openContextMenuFactory(FileTreeContextMenuItems)
export const closeContextMenu = contextMenuStore.closeContextMenu

export function openNode (node, shouldBeFolded = null, deep = false) {
  if (node.isDir) {
    if (!node.children.length) {
      api.fetchPath(node.path)
        .then(data => FileStore.loadNodeData(data))
        .then(() => toggleNodeFold(node, shouldBeFolded, deep))
    } else {
      toggleNodeFold(node, shouldBeFolded, deep)
    }
  } else {
    if (getTabType(node) === 'TEXT') {
      api.readFile(node.path)
        .then(data => {
          TabActions.createTab({
            id: _.uniqueId('tab_'),
            type: 'editor',
            title: node.name,
            path: node.path,
            icon: 'fa fa-file-o',
            content: data.content,
            contentType: node.contentType,
          })
        })
    } else {
      TabActions.createTab({
        id: _.uniqueId('tab_'),
        type: 'editor',
        title: node.name,
        path: node.path,
        icon: 'fa fa-file-o',
        contentType: node.contentType,
        size: node.size
      })
    }
  }
}

export const uploadFilesToPath = (files, path) => {
  if (!files.length) return
  const node = state.entities.get(path)
  const targetDirPath = node.isDir ? node.path : (node.parent.path || '/')
  _(files).forEach(file => {
    api.uploadFile(targetDirPath, file, {
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        // updateUploadProgress(percentCompleted)
        // if (percentCompleted === 100) {
        //   setTimeout(() => updateUploadProgress(''), 3000)
        // }
      }
    })
  })
}
