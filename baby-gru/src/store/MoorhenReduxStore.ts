import { configureStore } from '@reduxjs/toolkit'
import moleculesReducer from './moleculesSlice'
import mapsReducer from './mapsSlice'
import mouseSettingsReducer from './mouseSettings'
import backupSettingsReducer from './backupSettingsSlice'
import shortcutSettingsReducer from './shortCutsSlice'
import labelSettingsReducer from './labelSettingsSlice'
import sceneSettingsReducer from './sceneSettingsSlice'
import miscAppSettingsReducer from './miscAppSettingsSlice'
import generalStatesReducer from './generalStatesSlice'
import hoveringStatesReducer from './hoveringStatesSlice'
import activeModalsReducer from './activeModalsSlice'
import mapContourSettingsReducer from './mapContourSettingsSlice'
import moleculeRepresentationsReducer from './moleculeRepresentationsSlice'
import moleculeMapUpdateReducer from './moleculeMapUpdateSlice'

export default configureStore({
    reducer: {
        molecules: moleculesReducer,
        maps: mapsReducer,
        mouseSettings: mouseSettingsReducer,
        backupSettings: backupSettingsReducer,
        shortcutSettings: shortcutSettingsReducer,
        labelSettings: labelSettingsReducer,
        sceneSettings: sceneSettingsReducer,
        miscAppSettings: miscAppSettingsReducer,
        generalStates: generalStatesReducer,
        hoveringStates: hoveringStatesReducer,
        activeModals: activeModalsReducer,
        mapContourSettings: mapContourSettingsReducer,
        moleculeRepresentations: moleculeRepresentationsReducer,
        moleculeMapUpdate: moleculeMapUpdateReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
})