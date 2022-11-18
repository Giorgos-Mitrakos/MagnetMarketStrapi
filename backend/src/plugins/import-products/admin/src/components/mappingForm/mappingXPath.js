import React, { memo, useContext, useEffect, useState } from 'react';
import { Box } from '@strapi/design-system/Box';
import { Textarea } from '@strapi/design-system/Textarea';
import { Tooltip } from '@strapi/design-system/Tooltip';
import Information from '@strapi/icons/Information';
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const MappingXPath = () => {
    const [importMapping, setImportMapping] = useContext(MappingContext)

    const handleXpathChange = (xpath) => {
        setImportMapping({ ...importMapping, xPath: xpath })
    }

    return (
        <Box padding={4} background="neutral100">
            <Textarea placeholder="XPath..." label="XPath" name="xPath" hint="Συμπληρώστε προαιρετικά το πεδίο XPath για μεγαλύτερη ελευθερία στο φιλτράρισμα του αρχείου του προμηθευτή"
                onChange={e => handleXpathChange(e.target.value)}
                labelAction={<Tooltip description="Content of the tooltip"
                    position="right">
                    <button aria-label="Information about the email" style={{
                        border: 'none',
                        padding: 0,
                        background: 'transparent'
                    }}>
                        <Information aria-hidden={true} />
                    </button>
                </Tooltip>}>
                {importMapping.xPath}
            </Textarea>
        </Box>
    )

}

export default MappingXPath